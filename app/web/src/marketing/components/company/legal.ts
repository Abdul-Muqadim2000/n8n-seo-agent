// Draft text for /privacy and /terms. PLACEHOLDER — every section is to be reviewed (and largely rewritten) by counsel before
// launch. The structure is generic; the few facts about how the product works are true today, and nothing here is a legal promise.

export interface LegalSection {
  id: string;
  title: string;
  /** paragraphs; a string starting with "• " renders as a bullet, "[…]" marks text counsel still has to write */
  body: string[];
}

export interface LegalDoc {
  path: '/privacy' | '/terms';
  title: string;
  description: string;
  intro: string;
  /** shown as "Last updated" — a draft date until counsel signs off */
  updated: string;
  sections: LegalSection[];
}

export const privacyDoc: LegalDoc = {
  path: '/privacy',
  title: 'Privacy policy',
  description: 'How Ascentra collects, uses and protects personal data. Draft, to be reviewed by counsel before launch.',
  intro:
    'This policy explains what personal data Ascentra handles when you visit this website or use the Ascentra app, why we handle it and the choices you have. It is a draft: the structure is in place and the details are still to be written and reviewed.',
  updated: '2026-10-08',
  sections: [
    {
      id: 'who-we-are',
      title: 'Who we are',
      body: [
        'Ascentra provides software that runs search engine optimisation work for companies: research, content, audits, tracking, AI search visibility and backlinks.',
        '[Legal entity name, registered address and company number — to be completed by counsel.]',
      ],
    },
    {
      id: 'scope',
      title: 'What this policy covers',
      body: [
        'This policy covers the public website and the Ascentra app. It does not cover the websites of third parties that Ascentra links to or reads data from.',
        '[Clarify the roles of Ascentra and its customers for customer data — to be completed by counsel.]',
      ],
    },
    {
      id: 'data-we-collect',
      title: 'Information we collect',
      body: [
        'Depending on how you use Ascentra, this can include:',
        '• Account details, such as your name, e-mail address and a hash of your password, or your Google account identity if you sign in with Google.',
        '• Company and team details, such as company name, members, roles and invitations.',
        '• Website details you add, such as domains, ownership verification records, business profile and author details.',
        '• Data from services you connect, such as Search Console and Google Analytics 4, read with read-only access.',
        '• Technical data, such as sign-in sessions, IP address and browser type, used to keep the service secure.',
        '[Complete and confirm the list of categories — to be completed by counsel.]',
      ],
    },
    {
      id: 'how-we-use',
      title: 'How we use information',
      body: [
        'We use information to provide the service you ask for: to run analyses, produce reports, keep your account secure, show costs and enforce budgets, and answer your messages.',
        '[Purposes and any further uses — to be completed by counsel.]',
      ],
    },
    {
      id: 'legal-bases',
      title: 'Legal bases',
      body: ['[Legal bases for each purpose, where applicable law requires them — to be completed by counsel.]'],
    },
    {
      id: 'sharing',
      title: 'Sharing and service providers',
      body: [
        'To run analyses, Ascentra sends the necessary parts of a request — for example a keyword, a question or a page address — to the AI and data providers that do the work.',
        '[List of service providers and categories of recipients — to be completed by counsel.]',
      ],
    },
    {
      id: 'transfers',
      title: 'International transfers',
      body: ['[Where data is processed and the safeguards used for transfers — to be completed by counsel.]'],
    },
    {
      id: 'retention',
      title: 'How long we keep data',
      body: ['[Retention periods for each category of data, and what happens when a website or company is deleted — to be completed by counsel.]'],
    },
    {
      id: 'security',
      title: 'Security',
      body: [
        'The measures Ascentra uses today — such as argon2id password hashing, roles per company, verified website ownership and isolation of each company’s data — are described on the Security page.',
      ],
    },
    {
      id: 'your-rights',
      title: 'Your rights and choices',
      body: ['[Rights available to users under applicable law, and how to exercise them — to be completed by counsel.]'],
    },
    {
      id: 'cookies',
      title: 'Cookies',
      body: [
        'The app uses cookies that are needed to keep you signed in and to complete Google sign-in.',
        '[Full cookie list and any choices offered — to be completed by counsel.]',
      ],
    },
    {
      id: 'children',
      title: 'Children',
      body: ['[Statement on use by children — to be completed by counsel.]'],
    },
    {
      id: 'changes',
      title: 'Changes to this policy',
      body: ['[How changes are made and announced — to be completed by counsel.]'],
    },
    {
      id: 'contact',
      title: 'Contact',
      body: ['Questions about this policy can be sent through the Contact page.', '[Data protection contact details — to be completed by counsel.]'],
    },
  ],
};

export const termsDoc: LegalDoc = {
  path: '/terms',
  title: 'Terms of service',
  description: 'The terms that govern the use of Ascentra. Draft, to be reviewed by counsel before launch.',
  intro:
    'These terms will govern the use of the Ascentra website and app. They are a draft: the structure is in place and the details are still to be written and reviewed.',
  updated: '2026-10-08',
  sections: [
    {
      id: 'agreement',
      title: 'Agreement to these terms',
      body: ['[Who the agreement is between, and how it is accepted — to be completed by counsel.]'],
    },
    {
      id: 'accounts',
      title: 'Accounts and companies',
      body: [
        'People use Ascentra through a company workspace. Each person has a role — owner, admin, member or viewer — that decides what they can do.',
        '[Responsibilities for accounts, credentials and the people you invite — to be completed by counsel.]',
      ],
    },
    {
      id: 'websites',
      title: 'Websites you connect',
      body: [
        'Ascentra shows data for a website only after its ownership is verified, through Search Console, a DNS TXT record or a meta tag.',
        '[Your confirmation that you are authorised to connect each website and its data — to be completed by counsel.]',
      ],
    },
    {
      id: 'acceptable-use',
      title: 'Acceptable use',
      body: ['[What the service may not be used for — to be completed by counsel.]'],
    },
    {
      id: 'generated-content',
      title: 'Generated content and recommendations',
      body: [
        'Ascentra prepares content, audits and recommendations with the help of AI. Your team reviews what Ascentra prepares and decides what to publish.',
        '[Ownership of generated content and the limits of recommendations — to be completed by counsel.]',
      ],
    },
    {
      id: 'fees',
      title: 'Plans, fees and usage',
      body: [
        'Every run shows its estimated cost before it starts, and runs are checked against the budget your company sets.',
        '[Plans, billing, taxes, renewals and refunds — to be completed by counsel.]',
      ],
    },
    {
      id: 'third-parties',
      title: 'Third-party services',
      body: ['Ascentra works with services such as Google Search Console, Google Analytics 4 and AI engines. Their own terms apply to them.', '[Further wording — to be completed by counsel.]'],
    },
    {
      id: 'ip',
      title: 'Intellectual property',
      body: ['[Ownership of the service and licences granted — to be completed by counsel.]'],
    },
    {
      id: 'confidentiality',
      title: 'Confidentiality',
      body: ['[Confidentiality obligations of both parties — to be completed by counsel.]'],
    },
    {
      id: 'disclaimers',
      title: 'Disclaimers',
      body: ['[Disclaimers, including that search rankings and AI answers depend on third parties — to be completed by counsel.]'],
    },
    {
      id: 'liability',
      title: 'Limitation of liability',
      body: ['[Limitation of liability — to be completed by counsel.]'],
    },
    {
      id: 'termination',
      title: 'Suspension and termination',
      body: ['[How either party can end the agreement, and what happens to data afterwards — to be completed by counsel.]'],
    },
    {
      id: 'changes',
      title: 'Changes to these terms',
      body: ['[How changes are made and announced — to be completed by counsel.]'],
    },
    {
      id: 'law',
      title: 'Governing law',
      body: ['[Governing law and venue — to be completed by counsel.]'],
    },
    {
      id: 'contact',
      title: 'Contact',
      body: ['Questions about these terms can be sent through the Contact page.', '[Legal notice address — to be completed by counsel.]'],
    },
  ],
};

export const legalDocs = { '/privacy': privacyDoc, '/terms': termsDoc } as const;
