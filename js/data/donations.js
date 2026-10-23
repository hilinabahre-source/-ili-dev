// Real, currently-active humanitarian crises tied to one article each,
// shown in the Donation Bin modal. Sourced and dated so they can be
// checked and refreshed as situations change.
export const DONATION_CAUSES = [
  {
    region: 'Sudan',
    blurb: 'Civil war entering its fourth year \u2014 now considered the largest humanitarian crisis ever recorded, with famine active in several regions.',
    article: {
      title: 'Sudan, world\u2019s largest humanitarian crisis, receives glimmer of hope',
      source: 'Final Call News \u00b7 Sept 1, 2026',
      url: 'https://new.finalcall.com/2026/09/01/sudan-worlds-largest-humanitarian-crisis-receives-glimmer-of-hope/'
    },
    charity: {
      name: 'UNHCR \u2014 Sudan Emergency',
      note: '4-star Charity Navigator rating',
      url: 'https://donate.unhcr.org/int/en/sudan-emergency'
    },
    campaign: {
      name: 'Keep Eyes on Sudan',
      note: 'Named campaign fighting global media silence on the crisis',
      url: 'https://donate.chooselove.org/campaigns/keep-eyes-on-sudan/'
    }
  },
  {
    region: 'Palestine',
    blurb: 'Humanitarian conditions remain critical across Gaza and the West Bank despite a ceasefire, with funding shortfalls cutting shelter assistance.',
    article: {
      title: 'Humanitarian Situation Report \u2014 10 July 2026',
      source: 'OCHA (occupied Palestinian territory)',
      url: 'https://www.ochaopt.org/content/humanitarian-situation-report-10-july-2026'
    },
    charity: {
      name: 'UNRWA \u2014 Gaza Emergency Appeal',
      note: 'UN agency for Palestine refugees',
      url: 'https://donate.unrwa.org/int/en/gaza'
    },
    campaign: {
      name: 'Hand in Hand with Palestine Refugees',
      note: 'UNRWA\u2019s current named giving campaign',
      url: 'https://www.unrwa.org/newsroom/news-releases/%E2%80%9Chand-hand-palestine-refugees%E2%80%9D-unrwa%E2%80%99s-ramadan-2026-campaign'
    }
  },
  {
    region: 'Afghanistan \u2014 Women & Girls',
    blurb: 'Five years into Taliban rule, over 160 decrees have systematically excluded women and girls from education, work, and public life.',
    article: {
      title: 'Five years after the Taliban takeover: the normalization of the exclusion of women and girls in Afghanistan',
      source: 'UN Women \u00b7 Aug 2026',
      url: 'https://www.unwomen.org/en/news-stories/press-release/2026/08/five-years-after-the-taliban-takeover-the-normalization-of-the-exclusion-of-women-and-girls-in-afghanistan'
    },
    charity: {
      name: 'UN Women',
      note: 'Funds direct services for Afghan women and girls',
      url: 'https://donate.unwomen.org/en'
    },
    campaign: {
      name: '#LetAfghanGirlsLearn',
      note: 'Named campaign for Afghan girls\u2019 right to education',
      url: 'https://womenforafghanwomen.org/let-afghan-girls-learn/'
    }
  },
  {
    region: 'Ethiopia',
    blurb: 'Overlapping conflict, drought, and steep funding cuts are deepening a crisis affecting millions \u2014 women and children hit hardest.',
    article: {
      title: 'Ethiopia crisis: Why millions need support\u2014and how you can help',
      source: 'International Rescue Committee \u00b7 June 2026',
      url: 'https://www.rescue.org/article/ethiopia-crisis-why-millions-need-support-and-how-you-can-help'
    },
    charity: {
      name: 'International Rescue Committee',
      note: '4-star Charity Navigator, 96% score',
      url: 'https://help.rescue.org/donate'
    },
    campaign: {
      name: '#\u1275\u1230\u121b \u2014 Tisema (\u201cLet Her Be Heard\u201d)',
      note: 'Advocacy campaign on violence against women & girls (petition, not a donation page)',
      url: 'https://tisema.org/'
    }
  }
];

export const DONATION_THUMBS = [
  { logoFile: 'UNHCR.svg', name: 'UNHCR' },
  { logoFile: 'United_Nations_Relief_and_Works_Agency_for_Palestine_Refugees_in_the_Near_East_Logo.svg', name: 'UNRWA' },
  { logoFile: 'UN_WOMEN_Logo.svg', name: 'UN Women' },
  { logoFile: 'International_Rescue_Committee_Logo.svg', name: 'International Rescue Committee' }
];
