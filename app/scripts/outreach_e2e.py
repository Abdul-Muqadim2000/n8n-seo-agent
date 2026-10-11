"""Link Builder end-to-end test (v4.13) against the dev stack and a local mail server — nothing leaves the machine, nothing paid.

    python3 app/scripts/outreach_e2e.py [--base http://localhost:4000] [--db seo-platform-dev-db-1] [--server seo-platform-dev-server-1]

GreenMail (a throwaway SMTP + IMAP server, docker image greenmail/standalone) runs on the dev network with fake addresses under *.test;
the app connects a mailbox to it, approves sequences, and the sender / inbox jobs are run at a weekday time (they never send at weekends).
Replies, an out-of-office, a bounce and an opt-out are delivered into the mailbox as real messages and read by the inbox job.
The n8n Link Builder rows of a throwaway test domain are written through the n8n API and removed at the end, with the test company.
Run it before the Reply Reader workflow is active (or accept one Claude Haiku call per reply, ≈ $0.001): without it the app's own rules
classify replies, which this test checks."""
import argparse, email, imaplib, json, os, secrets, smtplib, subprocess, sys, time, urllib.parse, urllib.request
from email.message import EmailMessage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from api import Api
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'n8n', 'seo-agent'))
from env_settings import load_env

p = argparse.ArgumentParser(); p.add_argument('--base', default='http://localhost:4000'); p.add_argument('--db', default='seo-platform-dev-db-1'); p.add_argument('--server', default='seo-platform-dev-server-1')
p.add_argument('--keep', help='leave the test company, its n8n rows and GreenMail for a browser check; writes their ids to this JSON file')
p.add_argument('--cleanup', help='remove what a --keep run left (the JSON file it wrote)')
args = p.parse_args()
if args.cleanup:
    k = json.load(open(args.cleanup)); TAG, DOMAIN = k['tag'], k['domain']
if not args.cleanup: TAG = secrets.token_hex(3); DOMAIN = f'lbtest-{TAG}.example.com'
SITE_ID = 'site_' + DOMAIN.replace('.', '-')
GM = 'lb-greenmail'; NET = 'seo-platform-dev_default'
USERS = {'outreach@lbtest.test': 'secretpw', 'editor@prospect-one.test': 'edpw', 'news@prospect-two.test': 'newspw', 'redaktion@prospect-three.de': 'depw', 'ghost@prospect-four.test': 'ghpw', 'hello@prospect-five.test': 'hipw'}
fails = []
def check(label, cond, detail=''):
    print(('PASS ' if cond else 'FAIL ') + label + ('' if cond else f'  -> {str(detail)[:600]}'))
    if not cond: fails.append(label)
def sql(q):
    return subprocess.run(['docker', 'exec', args.db, 'psql', '-U', 'seo', '-d', 'seo', '-tAc', q], capture_output=True, text=True).stdout.strip()
env = load_env(); N8N = 'http://localhost:5678/api/v1'; KEY = env.get('N8N_API_KEY', '')
def n8n(path, method='GET', body=None):
    r = urllib.request.Request(N8N + path, data=json.dumps(body).encode() if body is not None else None, method=method, headers={'X-N8N-API-KEY': KEY, 'content-type': 'application/json'})
    with urllib.request.urlopen(r, timeout=30) as x: b = x.read(); return json.loads(b) if b else None
def table_id(name): return next((t['id'] for t in n8n('/data-tables?limit=250')['data'] if t['name'] == name), None)
def job(fn, now):
    code = ("import('./src/services/outreachJobs.ts').then(async (m) => { const log = { info: () => {}, warn: (o, msg) => console.error('WARN', msg, JSON.stringify(o)), error: (o, msg) => console.error('ERR', msg, JSON.stringify(o)) };"
            f" const n = await m.{fn}(log{', new Date(' + json.dumps(now) + ')' if now else ''}); console.log('RESULT', n); process.exit(0); }}).catch((e) => {{ console.error(e); process.exit(1); }});")
    r = subprocess.run(['docker', 'exec', args.server, 'sh', '-c', f'cd /app/server && npx tsx -e {json.dumps(code)}'], capture_output=True, text=True, timeout=180)
    out = (r.stdout + r.stderr).strip(); res = [l for l in out.splitlines() if l.startswith('RESULT')]
    return int(res[-1].split()[1]) if res else -1, out
def inbox(user, pw):
    m = imaplib.IMAP4('127.0.0.1', 3143); m.login(user, pw); m.select('INBOX'); _, ids = m.search(None, 'ALL'); msgs = []
    for i in ids[0].split(): _, d = m.fetch(i, '(RFC822)'); msgs.append(email.message_from_bytes(d[0][1]))
    m.logout(); return msgs
def deliver(frm, to, subject, body, headers=None, raw=None):
    s = smtplib.SMTP('127.0.0.1', 3025, timeout=20); s.login(frm, USERS.get(frm, 'x'))
    if raw: s.sendmail(frm, [to], raw)
    else:
        m = EmailMessage(); m['From'] = frm; m['To'] = to; m['Subject'] = subject; m['Message-ID'] = email.utils.make_msgid(domain=frm.split('@')[1])
        for k, v in (headers or {}).items(): m[k] = v
        m.set_content(body); s.send_message(m)
    s.quit()
def text_of(m):
    if m.is_multipart():
        for part in m.walk():
            if part.get_content_type() == 'text/plain': return part.get_payload(decode=True).decode('utf-8', 'replace')
    return m.get_payload(decode=True).decode('utf-8', 'replace')

if args.cleanup:
    O = k['org']; sql(f"delete from organizations where id='{O}'"); sql(f"delete from users where email like 'lb-owner-{TAG}@example.org'")
    for name in ('seo_link_outreach', 'seo_listings', 'seo_link_prospects', 'seo_link_impact'):
        tid = table_id(name)
        if tid: n8n(f"/data-tables/{tid}/rows/delete?filter=" + urllib.parse.quote(json.dumps({'type': 'and', 'filters': [{'columnName': 'domain', 'condition': 'eq', 'value': DOMAIN}]}, separators=(',', ':'))), 'DELETE')
    subprocess.run(['docker', 'rm', '-f', GM], capture_output=True); print('cleaned up', DOMAIN); sys.exit(0)
subprocess.run(['docker', 'rm', '-f', GM], capture_output=True)
users = ','.join(f"{u.split('@')[0]}:{pw}@{u.split('@')[1]}" for u, pw in USERS.items())
r = subprocess.run(['docker', 'run', '-d', '--rm', '--name', GM, '--network', NET, '-p', '127.0.0.1:3025:3025', '-p', '127.0.0.1:3143:3143',
                    '-e', f'GREENMAIL_OPTS=-Dgreenmail.setup.test.smtp -Dgreenmail.setup.test.imap -Dgreenmail.hostname=0.0.0.0 -Dgreenmail.users={users} -Dgreenmail.users.login=email -Dgreenmail.verbose=false', 'greenmail/standalone:2.1.2'], capture_output=True, text=True)
check('GreenMail started (local SMTP + IMAP, fake *.test addresses)', r.returncode == 0, r.stderr)
for _ in range(30):
    try: imaplib.IMAP4('127.0.0.1', 3143).logout(); break
    except Exception: time.sleep(1)
O = None; tids = {}
try:
    a = Api(args.base); me = f'lb-owner-{TAG}@example.org'
    s, _ = a.post('/api/auth/signup', {'name': 'Link Owner', 'email': me, 'password': 'link-builder-pass-1'})
    sql(f"update users set email_verified_at=now() where email='{me}'")
    s, org = a.post('/api/orgs', {'name': f'LB Test {TAG}', 'size': '2-10'}); O = org['id']
    s, site = a.post(f'/api/orgs/{O}/sites', {'domain': DOMAIN, 'country': 'United Arab Emirates'}); S = site['id']
    sql(f"update sites set verified_at=now(), verification_method='dns' where id='{S}'")
    check('test company and verified website', bool(O and S), [org, site])
    # ---- the n8n rows the Link Builder workflow would have written ----
    seq = lambda subj: json.dumps([{'step': 0, 'wait_days': 0, 'subject': subj, 'body': 'Hi,\n\nThe link "UAE e-invoicing guide" on your page is dead. Our guide covers the same subject: https://' + DOMAIN + '/insights/e-invoicing-in-uae\n\nSara Khan, Head of Finance Systems, LB Test'},
                                   {'step': 1, 'wait_days': 4, 'subject': '', 'body': 'One more detail: our guide has the 2027 deadlines in a table.'}, {'step': 2, 'wait_days': 8, 'subject': '', 'body': 'Who would be the right person for this? I will not write again.'}])
    def row(d, t, contact, country, subj):
        return {'site_id': SITE_ID, 'domain': DOMAIN, 'prospect_domain': d, 'type': t, 'status': 'drafted', 'score': 50, 'fit': 0.7, 'fit_reason': 'topic match 70%', 'checks_json': '{}', 'page_url': f'https://{d}/page', 'page_title': 'A page on ' + d, 'evidence': 'evidence',
                'contacts_json': json.dumps([{'email': contact, 'kind': 'editorial', 'own': True, 'source_url': f'https://{d}/contact'}]), 'contact_email': contact, 'contact_form_url': '', 'country': country, 'language': 'en', 'target_url': f'https://{DOMAIN}/', 'target_reason': 'test',
                'anchor_hint': 'brand', 'sequence_json': seq(subj), 'deadline': '', 'drafted_at': '2026-10-12T08:00:00Z', 'checked_at': '2026-10-12T08:00:00Z', 'request_id': 'e2e'}
    for name in ('seo_link_outreach', 'seo_listings', 'seo_link_prospects'): tids[name] = table_id(name)
    check('n8n tables exist (deploy the Link Builder first: its Ensure nodes create them)', all(tids.values()), tids)
    rows = [row('prospect-one.test', 'list', 'editor@prospect-one.test', 'GB', 'Your list of UAE e-invoicing providers'), row('prospect-two.test', 'mention', 'news@prospect-two.test', 'AE', 'Thanks for naming us in your piece'),
            row('prospect-three.de', 'gap', 'redaktion@prospect-three.de', 'DE', 'Ein Leitfaden für Ihre Leser'), row('prospect-four.test', 'resource', 'ghost@prospect-four.test', 'US', 'A resource for your e-invoicing page'),
            row('prospect-five.test', 'gap', 'hello@prospect-five.test', 'US', 'A current page for your readers')]
    n8n(f"/data-tables/{tids['seo_link_outreach']}/rows", 'POST', {'data': rows, 'returnType': 'count'})
    n8n(f"/data-tables/{tids['seo_listings']}/rows", 'POST', {'data': [{'site_id': SITE_ID, 'domain': DOMAIN, 'listing_id': 'g2', 'name': 'G2', 'category': 'reviews', 'status': 'missing', 'profile_url': '', 'rel': 'none', 'competitors': 'cleartax.com', 'submit_url': 'https://sell.g2.com/', 'priority': 1, 'why': 'test', 'checked_at': '2026-10-12T08:00:00Z', 'submitted_at': '', 'note': ''}], 'returnType': 'count'})
    # ---- the mailbox ----
    mb = {'fromName': 'Sara Khan', 'fromEmail': 'outreach@lbtest.test', 'smtpHost': GM, 'smtpPort': 3025, 'smtpSecure': False, 'imapHost': GM, 'imapPort': 3143, 'imapSecure': False, 'username': 'outreach@lbtest.test', 'password': 'wrong-password',
          'signatureName': 'Sara Khan', 'signatureTitle': 'Head of Finance Systems', 'company': 'LB Test', 'postalAddress': 'Office 1204, Bay Square, Dubai, UAE', 'timezone': 'UTC', 'windowStart': 0, 'windowEnd': 24, 'dailyFirstMax': 20, 'dailyMax': 50}
    s, d = a.post(f'/api/orgs/{O}/mailboxes', mb)
    check('a wrong password is refused before anything is stored (both logins tested)', s == 400 and d.get('code') == 'mailbox_test_failed', d)
    s, d = a.post(f'/api/orgs/{O}/mailboxes', {**mb, 'password': 'secretpw'}); MB = d.get('id') if isinstance(d, dict) else None
    check('mailbox connected (SMTP + IMAP logins work); DNS checked; the password never comes back', s == 200 and MB and 'password' not in d and 'secret' not in d and d['dns']['spf'] in ('missing', 'pass', 'weak'), d)
    stored = sql(f"select secret from mailboxes where id='{MB}'")
    check('the password is stored encrypted (AES-256-GCM)', stored.startswith('v1:') and 'secretpw' not in stored, stored[:12])
    s, L = a.get(f'/api/orgs/{O}/sites/{S}/link-building')
    check('board: 5 drafts, can send', s == 200 and len(L['drafts']) == 5 and L['canSend']['ok'], {k: L.get(k) for k in ('canSend',)} if isinstance(L, dict) else L)
    de = next((x for x in L['drafts'] if x['prospectDomain'] == 'prospect-three.de'), {})
    check('a German recipient needs consent (UWG §7)', de.get('consent', {}).get('needed') is True, de.get('consent'))
    steps = lambda dd: dd['steps']
    s, d = a.post(f'/api/orgs/{O}/sites/{S}/link-building/approve', {'prospectDomain': 'prospect-three.de', 'type': 'gap', 'toEmail': 'redaktion@prospect-three.de', 'steps': steps(de), 'consent': False})
    check('approve without consent is refused (409 consent_needed)', s == 409 and d.get('code') == 'consent_needed', d)
    ids = {}
    for dom, t, to, extra in [('prospect-one.test', 'list', 'editor@prospect-one.test', {}), ('prospect-two.test', 'mention', 'news@prospect-two.test', {}), ('prospect-four.test', 'resource', 'ghost@prospect-four.test', {}), ('prospect-five.test', 'gap', 'hello@prospect-five.test', {})]:
        dd = next(x for x in L['drafts'] if x['prospectDomain'] == dom); st = steps(dd)
        if dom == 'prospect-one.test': st[0]['subject'] = 'Your UAE e-invoicing list (edited)'
        s, d = a.post(f'/api/orgs/{O}/sites/{S}/link-building/approve', {'prospectDomain': dom, 'type': t, 'toEmail': to, 'steps': st, 'consent': False, **extra}); ids[dom] = d.get('id')
        check(f'approve {dom}', s == 200 and d.get('ok'), d)
    s, d = a.post(f'/api/orgs/{O}/sites/{S}/link-building/approve', {'prospectDomain': 'prospect-one.test', 'type': 'list', 'toEmail': 'editor@prospect-one.test', 'steps': steps(next(x for x in L['drafts'] if x['prospectDomain'] == 'prospect-one.test'))})
    check('a second conversation with the same site is refused', s == 409 and 'already going on' in str(d.get('error', '')), d)
    # ---- the sender, at a weekday time (Monday 12 October 2026, 09:00 UTC), one e-mail per run, 4-9 minutes apart ----
    n0, out0 = job('senderTick', '2026-10-10T09:00:00Z')
    check('no e-mail at the weekend (Saturday)', n0 == 0, out0)
    sent = 0
    for i in range(6):
        n, out = job('senderTick', f'2026-10-12T{9 + i // 6:02d}:{(i % 6) * 10:02d}:00Z'); sent += max(0, n)
        if n < 0: check('sender run', False, out)
    check('the sender sent the 4 first e-mails one per run, 10 minutes apart', sent == 4, sent)
    m1 = inbox('editor@prospect-one.test', 'edpw')
    check('editor@prospect-one.test got one e-mail', len(m1) == 1, len(m1))
    e1 = m1[0] if m1 else EmailMessage(); body1 = text_of(e1) if m1 else ''
    check('the e-mail: our edited subject, plain text, From the person, the postal address, the opt-out line, the GDPR source line (UK recipient), an unsubscribe header, our Message-ID',
          e1['Subject'] == 'Your UAE e-invoicing list (edited)' and 'Sara Khan' in str(e1['From']) and 'Bay Square' in body1 and 'reply "no"' in body1 and 'I found your address on https://prospect-one.test/contact' in body1
          and 'mailto:outreach@lbtest.test?subject=unsubscribe' in str(e1['List-Unsubscribe']) and str(e1['Message-ID']).startswith('<lb.') and e1.get_content_type() == 'text/plain', [e1['Subject'], e1['From'], e1['Message-ID'], body1[-300:]])
    m2 = inbox('news@prospect-two.test', 'newspw'); body2 = text_of(m2[0]) if m2 else ''
    check('a UAE recipient gets no GDPR source line', m2 and 'I found your address' not in body2, body2[-200:])
    st1 = sql(f"select status, step from outreach_sequences where id='{ids['prospect-one.test']}'")
    check('the sequence is active at step 1 (its follow-up waits 4 working days)', st1 == 'active|1', st1)
    # ---- what comes back: a person, an out-of-office, a bounce, an opt-out ----
    deliver('editor@prospect-one.test', 'outreach@lbtest.test', 'Re: ' + str(e1['Subject']), 'Thanks Sara! Could you send me a short description and your logo?\n\nOn Mon, Sara wrote:\n> Hi', {'In-Reply-To': str(e1['Message-ID']), 'References': str(e1['Message-ID'])})
    deliver('news@prospect-two.test', 'outreach@lbtest.test', 'Automatic reply: ' + str(m2[0]['Subject'] if m2 else ''), 'I am out of the office until 20 October.', {'Auto-Submitted': 'auto-replied', 'In-Reply-To': str(m2[0]['Message-ID'] if m2 else '')})
    m4 = inbox('ghost@prospect-four.test', 'ghpw'); mid4 = str(m4[0]['Message-ID']) if m4 else '<none>'
    dsn = ('From: Mail Delivery Subsystem <mailer-daemon@prospect-four.test>\r\nTo: outreach@lbtest.test\r\nSubject: Delivery Status Notification (Failure)\r\nMessage-ID: <dsn1@prospect-four.test>\r\nMIME-Version: 1.0\r\n'
           'Content-Type: multipart/report; report-type=delivery-status; boundary="BB"\r\n\r\n--BB\r\nContent-Type: text/plain\r\n\r\nAddress not found\r\n\r\n--BB\r\nContent-Type: message/delivery-status\r\n\r\nReporting-MTA: dns; prospect-four.test\r\n\r\n'
           'Final-Recipient: rfc822; ghost@prospect-four.test\r\nAction: failed\r\nStatus: 5.1.1\r\n\r\n--BB\r\nContent-Type: text/rfc822-headers\r\n\r\nFrom: outreach@lbtest.test\r\nTo: ghost@prospect-four.test\r\nMessage-ID: ' + mid4 + '\r\n\r\n--BB--\r\n')
    deliver('ghost@prospect-four.test', 'outreach@lbtest.test', '', '', raw=dsn)
    n, out = job('pollTick', None)
    check('the inbox job read the 3 messages', n >= 3, out)
    r1 = sql(f"select status, coalesce(reply_class,''), reply_from from outreach_sequences where id='{ids['prospect-one.test']}'")
    check("a person's reply stops the sequence (replied, no more follow-ups)", r1.startswith('replied|') and r1.endswith('|editor@prospect-one.test'), r1)
    r2 = sql(f"select status, ooo_until is not null, next_at > '2026-10-19' from outreach_sequences where id='{ids['prospect-two.test']}'")
    check('an out-of-office keeps the sequence, its follow-up waits', r2 == 'active|t|t', r2)
    r4 = sql(f"select status from outreach_sequences where id='{ids['prospect-four.test']}'")
    check('a hard bounce: bounced, the address suppressed', r4 == 'bounced' and sql(f"select count(*) from suppressions where org_id='{O}' and reason='hard bounce'") == '1', r4)
    deliver('news@prospect-two.test', 'outreach@lbtest.test', 'Re: ' + str(m2[0]['Subject'] if m2 else ''), 'no thanks, please remove me from your list', {'In-Reply-To': str(m2[0]['Message-ID'] if m2 else '')})
    n, out = job('pollTick', None)
    r2b = sql(f"select status, reply_class from outreach_sequences where id='{ids['prospect-two.test']}'")
    check('an opt-out ("no thanks, please remove me"): replied / unsubscribe, the address suppressed', r2b == 'replied|unsubscribe' and sql(f"select count(*) from suppressions where org_id='{O}' and reason='asked not to be contacted'") == '1', r2b)
    # ---- answering in the thread from the app ----
    s, d = a.post(f"/api/orgs/{O}/sites/{S}/link-building/sequences/{ids['prospect-one.test']}/reply", {'body': 'Of course — here is a 50-word description: ...'})
    m1b = inbox('editor@prospect-one.test', 'edpw'); last = m1b[-1] if m1b else EmailMessage()
    check('the answer goes out in the same thread (Re:, In-Reply-To = their reply)', s == 200 and len(m1b) == 2 and str(last['Subject']).startswith('Re: ') and str(last['In-Reply-To']).endswith('prospect-one.test>'), [s, d, last['Subject'], last['In-Reply-To']])
    # ---- a follow-up after 4 working days, threaded ----
    n, out = job('senderTick', '2026-10-15T10:00:00Z')
    check('no follow-up before its date (Thursday: the 4th working day after Monday is Friday)', n == 0, out)
    n, out = job('senderTick', '2026-10-16T10:00:00Z')
    m5 = inbox('hello@prospect-five.test', 'hipw')
    check('follow-up 1 on the 4th working day, in the same thread; nothing to the sites that replied, bounced, opted out or are out of office', n == 1 and len(m5) == 2 and str(m5[1]['Subject']).startswith('Re: ') and str(m5[1]['In-Reply-To']) == str(m5[0]['Message-ID']) and len(inbox('news@prospect-two.test', 'newspw')) == 1, [n, len(m5), out[-300:]])
    # ---- opt-out list, board numbers, listings ----
    s, d = a.post(f'/api/orgs/{O}/sites/{S}/link-building/approve', {'prospectDomain': 'prospect-two.test', 'type': 'mention', 'toEmail': 'news@prospect-two.test', 'steps': [{'step': 0, 'waitDays': 0, 'subject': 'x', 'body': 'y'}]})
    check('an opted-out address cannot be written to again', s == 409 and d.get('code') == 'suppressed', d)
    s, L = a.get(f'/api/orgs/{O}/sites/{S}/link-building'); k = L['kpis']
    check('numbers: 4 contacted, 2 people replied (auto-replies not counted), 1 bounce, 1 opt-out', k['contactedDomains'] == 4 and k['replied'] == 2 and k['unsubscribes'] == 1 and k['bounceRate'] == 25.0, k)
    s, d = a.post(f'/api/orgs/{O}/sites/{S}/link-building/listings/g2', {'status': 'submitted'})
    lst = n8n(f"/data-tables/{tids['seo_listings']}/rows?" + urllib.parse.urlencode({'filter': json.dumps({'type': 'and', 'filters': [{'columnName': 'site_id', 'condition': 'eq', 'value': SITE_ID}]}, separators=(',', ':'))}, quote_via=urllib.parse.quote))['data']
    check('"I\'ve submitted" is saved on the listing (n8n row)', s == 200 and lst and lst[0]['status'] == 'submitted' and lst[0]['submitted_at'], lst)
finally:
    if args.keep and O:
        json.dump({'org': O, 'site': S, 'email': me, 'password': 'link-builder-pass-1', 'domain': DOMAIN, 'tag': TAG}, open(args.keep, 'w')); print('kept for a browser check:', args.keep); O = None; tids = {}; GM_KEEP = True
    if O: sql(f"delete from organizations where id='{O}'"); sql(f"delete from users where email like 'lb-owner-{TAG}@example.org'")
    for name, tid in tids.items():
        if not tid: continue
        try: n8n(f"/data-tables/{tid}/rows/delete?filter=" + urllib.parse.quote(json.dumps({'type': 'and', 'filters': [{'columnName': 'domain', 'condition': 'eq', 'value': DOMAIN}]}, separators=(',', ':'))), 'DELETE')
        except Exception as e: print('cleanup', name, e)
    if not args.keep: subprocess.run(['docker', 'rm', '-f', GM], capture_output=True)
print('\nALL PASSED' if not fails else f'\n{len(fails)} FAILED: ' + '; '.join(fails))
sys.exit(1 if fails else 0)
