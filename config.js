// Site configuration. Fill these in once: the app and the legal pages read them.
window.WIKIIO = {
  name: 'Warmer',                   // brand name
  domain: 'playwarmer.app',           // shown on share cards and in the footer
  brandA: 'Warm', brandB: 'er',     // wordmark is brandA + accent-coloured italic brandB
  api: '',                          // base URL of the leaderboard API (e.g. 'https://api.example.com'); '' = same origin
  operator: 'William Cherry',                     // legal name of the person or company running the site (REQUIRED before launch)
  contact: 'will@cherrys.me.uk',                      // public contact email for privacy requests (REQUIRED before launch)
  checkoutUrl: '',                  // Supporter pack checkout link; {pid} is replaced by the buyer's anonymous player ID (see worker/README.md)
  adsenseClient: '',                // Google AdSense publisher id (ca-pub-…) switches on the optional rewarded video; empty = no ads at all
  adsenseTest: false,               // true while testing: shows Google's test ads
  analytics: '',                    // optional Cloudflare Web Analytics token (cookie-free); leave empty for none
  paymentProvider: 'stripe',        // 'stripe' (you are the seller) or 'lemonsqueezy' / 'paddle' (they are the seller of record): switches the wording of the legal pages
  price: '£2.99',
  jurisdiction: 'England and Wales',
  updated: '23 October 2026'
};
