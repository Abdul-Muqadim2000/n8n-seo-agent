#!/usr/bin/env bash
# bootstrap.sh — creates (or finds) everything Alaventra needs in Google Cloud, idempotently.
#
#   deploy/gcp/bootstrap.sh              dry run (default): reads the project, prints every command it WOULD run, changes nothing
#   deploy/gcp/bootstrap.sh --apply      runs them
#
# Every step first asks Google whether the thing exists (read-only describe/list, in both modes) and only then creates it, so a
# second run changes nothing, and resources made by hand (the project, the static IP, the budget of 2026-10-18) are reused as they are.
# Order: project + billing + APIs -> network + firewall -> service account -> backup bucket -> data disk + snapshot schedule ->
# health check + template + managed instance group (one Spot VM, stateful disks and IP) -> uptime checks + alert -> budget -> cost.
# The VM starts only when the three settings secrets exist (load_secrets.sh) — its startup script needs them.
#
# Settings (environment variables; the defaults are the decisions of 2026-10-18):
#   PROJECT ascentra-prod · BILLING 0122E1-574F3D-7CDF90 · REGION me-central1 · ZONE me-central1-a · NAME ascentra (resource prefix)
#   MACHINE e2-medium · BOOT_TYPE pd-balanced BOOT_SIZE 20 · DATA_TYPE pd-balanced DATA_SIZE 20 (RUNBOOK §2: why not pd-standard)
#   DOMAIN 34-18-181-79.sslip.io (until a real one) · ALERT_EMAIL muqadim2000@gmail.com · REF feature/seo-agent-v4.5 (branch the VM runs)
#   GCLOUD gcloud (the command to run gcloud with; e.g. a Docker wrapper)
set -euo pipefail

APPLY=0
for a in "$@"; do
  case "$a" in
    --apply) APPLY=1 ;;
    --dry-run) APPLY=0 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown argument: $a" >&2; exit 2 ;;
  esac
done

PROJECT=${PROJECT:-ascentra-prod}
BILLING=${BILLING:-0122E1-574F3D-7CDF90}
REGION=${REGION:-me-central1}
ZONE=${ZONE:-me-central1-a}
NAME=${NAME:-ascentra}
MACHINE=${MACHINE:-e2-medium}
BOOT_TYPE=${BOOT_TYPE:-pd-balanced}
BOOT_SIZE=${BOOT_SIZE:-20}
DATA_TYPE=${DATA_TYPE:-pd-balanced}
DATA_SIZE=${DATA_SIZE:-20}
IP_NAME=${IP_NAME:-$NAME-ip}
DOMAIN=${DOMAIN:-34-18-181-79.sslip.io}
ALERT_EMAIL=${ALERT_EMAIL:-muqadim2000@gmail.com}
REPO=${REPO:-https://github.com/Abdul-Muqadim2000/n8n-seo-agent.git}
REF=${REF:-feature/seo-agent-v4.5}
BUDGET_USD=${BUDGET_USD:-25}
GCLOUD=${GCLOUD:-gcloud}
read -r -a G <<< "$GCLOUD"

HERE=$(cd "$(dirname "$0")" && pwd)
NET=$NAME-net
SUBNET=$NAME-$REGION
SA=$NAME-vm@$PROJECT.iam.gserviceaccount.com
BUCKET=$PROJECT-backups
DISK=$NAME-data
POLICY=$NAME-daily-snapshots
HC=$NAME-hc
MIG=$NAME-mig
VM=$NAME-vm-1
SECRETS=("$NAME-prod-env" "$NAME-n8n-env" "$NAME-app-env")
APIS=(compute.googleapis.com iap.googleapis.com secretmanager.googleapis.com storage.googleapis.com monitoring.googleapis.com
      logging.googleapis.com billingbudgets.googleapis.com cloudresourcemanager.googleapis.com oslogin.googleapis.com)
# Google's own address ranges: IAP TCP forwarding (SSH) and the load-balancer / autohealing health-check probers
IAP_RANGE=35.235.240.0/20
HC_RANGES=35.191.0.0/16,130.211.0.0/22

TMP=$(mktemp -d "${TMPDIR:-/tmp}/alaventra-bootstrap.XXXXXX"); trap 'rm -rf "$TMP"' EXIT
CHANGES=0
say()  { printf '%s\n' "$*"; }
head_() { printf '\n== %s\n' "$*"; }
q()    { "${G[@]}" "$@" --project="$PROJECT" --quiet >/dev/null 2>&1; }   # read-only existence check
# run: print the command; execute it only with --apply
run() {
  CHANGES=$((CHANGES + 1))
  local shown; shown=$(printf ' %q' "$@")
  if [ "$APPLY" = 1 ]; then printf '+ gcloud%s\n' "$shown"; "${G[@]}" "$@"; else printf '  would run: gcloud%s\n' "$shown"; fi
}
keep() { say "  = exists, kept: $*"; }

say "Alaventra bootstrap — project $PROJECT, $REGION/$ZONE, mode: $([ "$APPLY" = 1 ] && echo APPLY || echo 'DRY RUN (nothing is changed)')"
say "domain: $DOMAIN  ->  api.$DOMAIN · hooks.$DOMAIN · app.$DOMAIN"

# ---- 1. project, billing, APIs --------------------------------------------------------------------------------------------
head_ "project and billing"
if "${G[@]}" projects describe "$PROJECT" --format='value(lifecycleState)' 2>/dev/null | grep -q ACTIVE; then keep "project $PROJECT"
else run projects create "$PROJECT" --name="Alaventra production"; fi
if [ "$("${G[@]}" billing projects describe "$PROJECT" --format='value(billingEnabled)' 2>/dev/null || true)" = "True" ]; then keep "billing link"
else run billing projects link "$PROJECT" --billing-account="$BILLING"; fi

head_ "APIs"
ENABLED=$("${G[@]}" services list --enabled --project="$PROJECT" --format='value(config.name)' 2>/dev/null || true)
for api in "${APIS[@]}"; do
  if grep -qx "$api" <<< "$ENABLED"; then keep "$api"; else run services enable "$api" --project="$PROJECT"; fi
done

# ---- 2. network and firewall ----------------------------------------------------------------------------------------------
# A network of our own: the project's `default` network allows SSH and RDP from the whole internet (default-allow-ssh / -rdp);
# nothing of ours is attached to it, and nothing here deletes it.
head_ "network and firewall"
if q compute networks describe "$NET"; then keep "network $NET"
else run compute networks create "$NET" --subnet-mode=custom --project="$PROJECT"; fi
if q compute networks subnets describe "$SUBNET" --region="$REGION"; then keep "subnet $SUBNET"
else run compute networks subnets create "$SUBNET" --network="$NET" --region="$REGION" --range=10.20.0.0/24 --enable-private-ip-google-access --project="$PROJECT"; fi
fw() {  # name, ports, sources, description
  if q compute firewall-rules describe "$1"; then keep "firewall $1 ($2 from $3)"
  else run compute firewall-rules create "$1" --network="$NET" --direction=INGRESS --action=ALLOW --rules="$2" --source-ranges="$3" \
         --target-tags="$NAME-vm" --description="$4" --project="$PROJECT"; fi
}
fw "$NAME-allow-web" tcp:80,tcp:443 0.0.0.0/0 "HTTPS (and the ACME / redirect port 80) to Caddy"
fw "$NAME-allow-iap-ssh" tcp:22 "$IAP_RANGE" "SSH only through IAP TCP forwarding - no public port 22"
fw "$NAME-allow-health" tcp:8081 "$HC_RANGES" "autohealing health checks (Google probers only)"

head_ "static IP"
IP=$("${G[@]}" compute addresses describe "$IP_NAME" --region="$REGION" --project="$PROJECT" --format='value(address)' 2>/dev/null || true)
if [ -n "$IP" ]; then keep "address $IP_NAME = $IP"
else run compute addresses create "$IP_NAME" --region="$REGION" --network-tier=PREMIUM --project="$PROJECT"; IP="<new address>"; fi
EXPECT_DOMAIN="${IP//./-}.sslip.io"
if [[ "$DOMAIN" == *sslip.io && "$DOMAIN" != "$EXPECT_DOMAIN" && "$IP" != "<new address>" ]]; then
  say "  ! DOMAIN=$DOMAIN does not match the address $IP (expected $EXPECT_DOMAIN)"; fi

# ---- 3. the VM's service account ------------------------------------------------------------------------------------------
# What the VM may do: read its three settings secrets, write and read backups in its bucket, write logs and metrics. Nothing else.
head_ "service account"
if q iam service-accounts describe "$SA"; then keep "$SA"
else run iam service-accounts create "$NAME-vm" --display-name="Alaventra VM" --project="$PROJECT"; fi
POLICY_JSON=$("${G[@]}" projects get-iam-policy "$PROJECT" --format=json 2>/dev/null || echo '{}')
for role in roles/logging.logWriter roles/monitoring.metricWriter roles/secretmanager.secretAccessor; do
  if grep -q "serviceAccount:$SA" <<< "$(python3 -c 'import json,sys; p=json.loads(sys.argv[1]); print("\n".join(m for b in p.get("bindings",[]) if b["role"]==sys.argv[2] for m in b["members"]))' "$POLICY_JSON" "$role")"; then
    keep "$role for the VM"
  else run projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role="$role" --condition=None; fi
done

# ---- 4. backup bucket ------------------------------------------------------------------------------------------------------
head_ "backup bucket"
cat > "$TMP/lifecycle.json" <<'EOF'
{"rule": [
  {"action": {"type": "Delete"}, "condition": {"age": 14}},
  {"action": {"type": "Delete"}, "condition": {"isLive": false, "daysSinceNoncurrentTime": 7}}
]}
EOF
if q storage buckets describe "gs://$BUCKET"; then keep "gs://$BUCKET"
else
  run storage buckets create "gs://$BUCKET" --location="$REGION" --default-storage-class=STANDARD --uniform-bucket-level-access \
      --public-access-prevention --soft-delete-duration=0 --project="$PROJECT"
  run storage buckets update "gs://$BUCKET" --versioning --lifecycle-file="$TMP/lifecycle.json" --project="$PROJECT"
  run storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$SA" --role=roles/storage.objectAdmin --project="$PROJECT"
fi

# ---- 5. data disk + daily snapshots ---------------------------------------------------------------------------------------
head_ "data disk and snapshots"
if q compute resource-policies describe "$POLICY" --region="$REGION"; then keep "snapshot schedule $POLICY"
else run compute resource-policies create snapshot-schedule "$POLICY" --region="$REGION" --daily-schedule --start-time=23:00 \
       --max-retention-days=7 --on-source-disk-delete=keep-auto-snapshots --storage-location="$REGION" --project="$PROJECT"; fi
if q compute disks describe "$DISK" --zone="$ZONE"; then keep "disk $DISK"
else run compute disks create "$DISK" --zone="$ZONE" --type="$DATA_TYPE" --size="${DATA_SIZE}GB" --resource-policies="$POLICY" --project="$PROJECT"; fi
if q compute disks describe "$DISK" --zone="$ZONE" && ! "${G[@]}" compute disks describe "$DISK" --zone="$ZONE" --project="$PROJECT" \
     --format='value(resourcePolicies)' 2>/dev/null | grep -q "$POLICY"; then
  run compute disks add-resource-policies "$DISK" --zone="$ZONE" --resource-policies="$POLICY" --project="$PROJECT"; fi

# ---- 6. health check, template, managed instance group ---------------------------------------------------------------------
head_ "health check, instance template, managed instance group"
if q compute health-checks describe "$HC"; then keep "health check $HC"
else run compute health-checks create http "$HC" --port=8081 --request-path=/healthz --check-interval=30s --timeout=10s \
       --healthy-threshold=2 --unhealthy-threshold=6 --project="$PROJECT"; fi

# The template's name carries a hash of everything in it (machine, disks, startup script, ref), so a change makes a new template and
# the group rolls to it (resize.sh); an unchanged run finds the same name and changes nothing.
HASH=$( { echo "$MACHINE $BOOT_TYPE $BOOT_SIZE $REF $REPO $NAME"; cat "$HERE/startup.sh"; } | shasum -a 256 | cut -c1-8)
TPL=$NAME-tpl-$(tr '[:upper:]' '[:lower:]' <<< "$MACHINE")-$HASH
if q compute instance-templates describe "$TPL"; then keep "template $TPL"
else
  run compute instance-templates create "$TPL" --machine-type="$MACHINE" \
      --provisioning-model=SPOT --instance-termination-action=STOP \
      --image-family=debian-12 --image-project=debian-cloud \
      --boot-disk-type="$BOOT_TYPE" --boot-disk-size="${BOOT_SIZE}GB" --boot-disk-device-name=boot \
      --network-interface="subnet=projects/$PROJECT/regions/$REGION/subnetworks/$SUBNET,network-tier=PREMIUM" \
      --service-account="$SA" --scopes=cloud-platform --tags="$NAME-vm" \
      --shielded-secure-boot --shielded-vtpm --shielded-integrity-monitoring \
      --metadata="enable-oslogin=TRUE,block-project-ssh-keys=TRUE,alaventra-name=$NAME,alaventra-ref=$REF,alaventra-repo=$REPO" \
      --metadata-from-file="startup-script=$HERE/startup.sh" \
      --region="$REGION" --project="$PROJECT"
fi
TPL_URL="projects/$PROJECT/regions/$REGION/instanceTemplates/$TPL"

if q compute instance-groups managed describe "$MIG" --zone="$ZONE"; then
  keep "group $MIG"
  CUR=$("${G[@]}" compute instance-groups managed describe "$MIG" --zone="$ZONE" --project="$PROJECT" --format='value(instanceTemplate.basename())' 2>/dev/null || true)
  if [ "$CUR" != "$TPL" ]; then
    say "  ! the group runs $CUR; this configuration is $TPL"
    run compute instance-groups managed set-instance-template "$MIG" --template="$TPL_URL" --zone="$ZONE" --project="$PROJECT"
    run compute instance-groups managed update-instances "$MIG" --all-instances --minimal-action=restart --most-disruptive-allowed-action=restart --zone="$ZONE" --project="$PROJECT"
  fi
else
  # size 0 first: the one VM is added below with its own stateful disk and address
  run compute instance-groups managed create "$MIG" --zone="$ZONE" --template="$TPL_URL" --size=0 \
      --health-check="$HC" --initial-delay=900 --default-action-on-vm-failure=repair \
      --stateful-disk=device-name=boot,auto-delete=on-permanent-instance-deletion --project="$PROJECT"
fi

head_ "the VM"
MISSING=()
for s in "${SECRETS[@]}"; do q secrets describe "$s" || MISSING+=("$s"); done
if q compute instances describe "$VM" --zone="$ZONE"; then keep "instance $VM"
elif [ "${#MISSING[@]}" -gt 0 ] && [ "$APPLY" = 1 ]; then
  say "  ! not creating $VM yet: secrets missing (${MISSING[*]}). Run deploy/gcp/load_secrets.sh --apply, then this script again."
else
  [ "${#MISSING[@]}" -gt 0 ] && say "  (secrets missing now: ${MISSING[*]} - load_secrets.sh must run before --apply reaches this step)"
  run compute instance-groups managed create-instance "$MIG" --zone="$ZONE" --instance="$VM" \
      --stateful-disk="device-name=data,source=projects/$PROJECT/zones/$ZONE/disks/$DISK,mode=rw,auto-delete=never" \
      --stateful-external-ip="address=projects/$PROJECT/regions/$REGION/addresses/$IP_NAME,interface-name=nic0,auto-delete=never" \
      --project="$PROJECT"
fi

# ---- 7. uptime checks and the alert ---------------------------------------------------------------------------------------
head_ "uptime checks and alert e-mail ($ALERT_EMAIL)"
CHANNEL=$("${G[@]}" beta monitoring channels list --project="$PROJECT" --filter="type=\"email\" AND labels.email_address=\"$ALERT_EMAIL\"" --format='value(name)' 2>/dev/null | head -1 || true)
if [ -n "$CHANNEL" ]; then keep "e-mail channel $CHANNEL"
else
  run beta monitoring channels create --display-name="Alaventra owner" --type=email --channel-labels="email_address=$ALERT_EMAIL" --project="$PROJECT"
  CHANNEL=$("${G[@]}" beta monitoring channels list --project="$PROJECT" --filter="type=\"email\" AND labels.email_address=\"$ALERT_EMAIL\"" --format='value(name)' 2>/dev/null | head -1 || true)
  CHANNEL=${CHANNEL:-"<the channel created above>"}
fi
UPTIME=$("${G[@]}" monitoring uptime list-configs --project="$PROJECT" --format='value(displayName)' 2>/dev/null || true)
up() {  # display name, host, path
  if grep -qx "$1" <<< "$UPTIME"; then keep "uptime check $1"
  else run monitoring uptime create "$1" --resource-type=uptime-url --resource-labels="host=$2,project_id=$PROJECT" --path="$3" \
         --protocol=https --port=443 --period=5 --timeout=10 --status-classes=2xx --project="$PROJECT"; fi
}
up "alaventra-api" "api.$DOMAIN" /api/health
up "alaventra-hooks" "hooks.$DOMAIN" /healthz
POLICIES=$("${G[@]}" alpha monitoring policies list --project="$PROJECT" --format='value(displayName)' 2>/dev/null || true)
if grep -qx "Alaventra is down" <<< "$POLICIES"; then keep "alert policy 'Alaventra is down'"
else
  cat > "$TMP/policy.json" <<'EOF'
{
  "displayName": "Alaventra is down",
  "documentation": {"content": "An uptime check of api./hooks. failed from two or more regions for 5 minutes. RUNBOOK: deploy/gcp/RUNBOOK.md §7 (what preemption looks like).", "mimeType": "text/markdown"},
  "combiner": "OR",
  "conditions": [{
    "displayName": "uptime check failing",
    "conditionThreshold": {
      "filter": "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\"",
      "aggregations": [{"alignmentPeriod": "1200s", "perSeriesAligner": "ALIGN_NEXT_OLDER", "crossSeriesReducer": "REDUCE_COUNT_FALSE", "groupByFields": ["resource.label.host"]}],
      "comparison": "COMPARISON_GT", "thresholdValue": 1, "duration": "300s", "trigger": {"count": 1}
    }
  }],
  "alertStrategy": {"autoClose": "1800s"}
}
EOF
  run alpha monitoring policies create --policy-from-file="$TMP/policy.json" --notification-channels="$CHANNEL" --project="$PROJECT"
fi

# ---- 8. budget ---------------------------------------------------------------------------------------------------------------
# A budget ALERTS (e-mail to the billing account's admins at 50 / 90 / 100 %); it never stops spending.
head_ "budget"
BUDGETS=$("${G[@]}" billing budgets list --billing-account="$BILLING" --billing-project="$PROJECT" --format='value(displayName)' 2>/dev/null || true)
if grep -qx "$PROJECT monthly" <<< "$BUDGETS"; then keep "budget '$PROJECT monthly'"
else run billing budgets create --billing-account="$BILLING" --billing-project="$PROJECT" --display-name="$PROJECT monthly" \
       --budget-amount="${BUDGET_USD}USD" --filter-projects="projects/$PROJECT" \
       --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0; fi

# ---- 9. what it costs ---------------------------------------------------------------------------------------------------------
head_ "expected monthly cost (USD, list prices for Doha read from the Cloud Billing catalog 2026-10-18; 730 h)"
python3 - "$MACHINE" "$BOOT_TYPE" "$BOOT_SIZE" "$DATA_TYPE" "$DATA_SIZE" <<'EOF'
import sys
machine, bt, bs, dt, ds = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4], float(sys.argv[5])
H = 730
core, ram = 0.01135, 0.001523           # Spot E2 core / RAM per hour, me-central1
vcpu, gib = {'e2-medium': (1, 4), 'e2-standard-2': (2, 8)}.get(machine, (1, 4))   # e2-medium bills as 1 vCPU (2 shared at 50 %)
pd = {'pd-standard': 0.0486, 'pd-balanced': 0.1215}
rows = [
  ('VM %s Spot: %d vCPU x 730 h x $%.5f' % (machine, vcpu, core), vcpu * H * core, 'list price'),
  ('VM %s Spot: %d GiB x 730 h x $%.6f' % (machine, gib, ram), gib * H * ram, 'list price'),
  ('boot disk %s %d GiB x $%.4f' % (bt, bs, pd[bt]), bs * pd[bt], 'list price'),
  ('data disk %s %d GiB x $%.4f' % (dt, ds, pd[dt]), ds * pd[dt], 'list price'),
  ('external IP in use on a Spot VM: 730 h x $0.0025', H * 0.0025, 'list price'),
  ('snapshots: ~9 GiB (7 daily incrementals of ~5 GiB used) x $0.03159', 9 * 0.03159, 'ESTIMATE (depends on daily change)'),
  ('backup bucket: ~5 GiB (14 nights of dumps) x $0.023', 5 * 0.023, 'ESTIMATE (depends on DB size)'),
  ('internet egress: ~8 GiB x $0.15 (Doha, first TiB)', 8 * 0.15, 'ESTIMATE (traffic)'),
  ('Secret Manager: 3 secrets (6 active versions free)', 0.0, 'free tier'),
  ('uptime checks + alerting + budget + IAP + logs (<50 GiB)', 0.0, 'free tier'),
]
w = max(len(r[0]) for r in rows)
for d, v, k in rows: print('  %-*s %7.2f   %s' % (w, d, v, k))
print('  %-*s %7.2f' % (w, 'TOTAL per month', sum(r[1] for r in rows)))
EOF

say ""
if [ "$APPLY" = 1 ]; then say "done: $CHANGES change(s) applied."
else say "dry run: $CHANGES change(s) would be made. Review them, then: deploy/gcp/bootstrap.sh --apply"; fi
