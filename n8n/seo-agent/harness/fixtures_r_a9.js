// A9 (2026-10-16, re-rating 2026-10-15 family F6) — minimal fixtures cut from the saved executions of the re-rating (exec 623 AI
// Brief: techand.ai's own weekly AI brief and its two token counts; exec 595: the Google Business Profile lookups, the crawl quote
// and the pages it crawled — task ids, costs and status only; exec 628 / 634: the gated answers' cost fields only). No third-party
// contact data; only public domains named in techand.ai's own report.
module.exports = {
 "ai_brief_output": {
  "headline": "Tech& was named in 0% of 74 AI answers this week (95% range 0–4.9%), even though all 5 engines asked know the brand.",
  "summary": "Tech& is not named in any answer on ChatGPT, Gemini, Perplexity, Claude or Google AI Overview/AI Mode, and none of the answers cite your pages. Nothing changed since last week: the 0 change is within sampling noise, so there is no trend. The assistants know who you are and describe you positively (sentiment 60): a Dubai-based Microsoft partner and Dynamics 365 ERP implementer with e-invoicing advisory. They still do not recommend you for e-invoicing questions. Tallysolutions.com (18.7% share), zoho.com and oracle.com (16.6% each) and microsoft.com (15%) win instead. The assistants lean on mof.gov.ae, tax.gov.ae, wafeq.com and edicomgroup.com. AI sent 0 visits, 0 key events and no revenue in the last 28 days. Crawlers are not the problem: 8 of 8 answer bots are allowed and llms.txt exists. The facts do not say whether AI's claims about you are accurate, because no business profile is on file to check against.",
  "actions": [
   {
    "priority": 1,
    "action": "Fill in the business profile (city, address, phone, price range) so the next run can fact-check what AI says about you.",
    "why": "Claims about Tech& were 'not checked' this week."
   },
   {
    "priority": 2,
    "action": "Publish a page that answers 'Which accredited service providers can I hire for UAE e-invoicing?' in a 40-60 word direct answer with a dated fact table. State clearly your own status and the official MoF list.",
    "why": "This question is lost to avalara.com, cleartax.com and comarch.com. The assistants search for the official MoF accredited-provider list."
   },
   {
    "priority": 3,
    "action": "Write pages on UAE e-invoicing requirements and deadlines, penalties, Peppol and cost. Use direct answers, dated facts and clear headings.",
    "why": "Lost to tallysolutions.com, zoho.com, krestonmenon.com and oracle.com. No answer cited your pages across 74 answers."
   },
   {
    "priority": 4,
    "action": "Pitch a guest article or comparison mention to wafeq.com, edicomgroup.com and aiverix.ae.",
    "why": "They are cited 15, 12 and 9 times on your topics. You are absent from all three."
   },
   {
    "priority": 5,
    "action": "Get listed on mof.gov.ae or tax.gov.ae if you qualify, and post an e-invoicing explainer on LinkedIn.",
    "why": "mof.gov.ae (26 citations) and tax.gov.ae (21) are the most trusted sources. LinkedIn has 9 citations."
   },
   {
    "priority": 6,
    "action": "Build a page for 'ERP implementation partner in Dubai with e-invoicing', based on your Dynamics 365 pages.",
    "why": "This question is lost to pactsoft.com, and your Dynamics pages are already cited at least once."
   }
  ],
  "watch": [
   "Whether the mention rate moves above 0 and clears the 5-point threshold.",
   "Whether any of your pages are cited, starting with the homepage (4 citations in the list of your cited pages).",
   "The Google AI Overview request failure (1 of 47), to confirm it is a one-off."
  ]
 },
 "ai_brief_counts": {
  "prompt": 4830,
  "answer": 4835
 },
 "gbp_595": [
  {
   "status_code": 20000,
   "tasks": [
    {
     "id": "10151905-2365-0572-0000-17e4b1d6fcb7",
     "cost": 0.0054,
     "status_code": 40102,
     "status_message": "No Search Results."
    }
   ]
  },
  {
   "status_code": 20000,
   "tasks": [
    {
     "id": "10151905-2365-0572-0000-bbd105f896f4",
     "cost": 0.0054,
     "status_code": 20000,
     "status_message": "Ok."
    }
   ]
  }
 ],
 "gbp_retry_595": [
  {
   "status_code": 20000,
   "tasks": [
    {
     "id": "10151906-2365-0572-0000-dae1e153c4d5",
     "cost": 0.0054,
     "status_code": 40102,
     "status_message": "No Search Results."
    }
   ]
  }
 ],
 "start_crawl_595": [
  {
   "status_code": 20000,
   "tasks": [
    {
     "id": "10151902-2365-0216-0000-3f3f17128538",
     "cost": 0.09,
     "status_code": 20100,
     "status_message": "Task Created."
    }
   ]
  }
 ],
 "check_crawl_595": {
  "pages_crawled": 47,
  "crawl_max_pages": 200
 },
 "lb_dfs_628": [
  {
   "__dfs": {
    "cost_usd": 0.0498,
    "tasks": 2
   },
   "__dfs_cost_usd": 0.0243
  },
  {
   "__dfs": {
    "cost_usd": 0.0498,
    "tasks": 2
   },
   "__dfs_cost_usd": 0
  },
  {
   "__dfs": {
    "cost_usd": 0.0498,
    "tasks": 2
   },
   "__dfs_cost_usd": 0.0254
  },
  {
   "__dfs": {
    "cost_usd": 0.0498,
    "tasks": 2
   },
   "__dfs_cost_usd": 0
  }
 ],
 "site_serp_634": [
  {
   "__dfs": {
    "cost_usd": 0.02,
    "tasks": 2
   },
   "__dfs_cost_usd": 0.01
  },
  {
   "__dfs": {
    "cost_usd": 0.02,
    "tasks": 2
   },
   "__dfs_cost_usd": 0.01
  }
 ],
 "site_trends_634": [
  {
   "__dfs": {
    "cost_usd": 0.011,
    "tasks": 1
   },
   "__dfs_cost_usd": 0.011
  }
 ]
};
