FIX PACK for techand.ai — SEO audit of 2026-10-02

* robots.txt: Replace /robots.txt (1 change(s))
* llms.txt: A refreshed /llms.txt (you already have one: compare first)
* organization.jsonld: Organization schema for the homepage (1 official profiles in sameAs)
* localbusiness.jsonld: LocalBusiness schema for the contact / location page (name, address and phone must match Google Business Profile)
* website.jsonld: WebSite schema for the homepage (site name shown in Google results)
* internal-links.csv: 10 internal links to add (from page → to page, with an anchor)

How to use: robots.txt and llms.txt go to the site root; add the redirects in your server or CDN (test a few URLs afterwards); paste the .jsonld blocks into the page <head> (organization + website on the homepage, localbusiness on the contact page), replace any [placeholder]; add the internal links in the page copy, with the anchor text or a natural variant. The next audit checks the result and lists what was fixed.
