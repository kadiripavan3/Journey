// Walks through the app the way a new person would, in the web build, against the local API:
// sign-up, following, Home, Discover, a journey and its story, starting a journey, posting and
// editing an entry with photos and a place, the map (a list of stops in a browser), a draft and an entry
// written offline that posts by itself when the connection is back, a short clip, the profile, Activity,
// likes, comments, following a creator, search,
// the weekly digest, sharing a link, shared journeys (inviting a friend, one person's part of the story, and being invited), settings, completing a journey, reporting,
// blocking, and at the end deleting the account. Along the way: the age confirmation, sharing an entry and a profile, a comment and a
// photo held for review, the one-time invite link, the legal pages, and the reviewer's queue (ADMIN_PASSWORD, "review" in local mode).
// It takes a screenshot of every screen and fails on the first thing that doesn't work.
//
// Before running: the API on port 8080 with the local profile, and the web build served on 8081
// (see CLAUDE.md, "Check the app in a browser"). Other addresses: set API_URL and WEB_URL, and build the
// web app with EXPO_PUBLIC_API_URL set to the same API address.
// usage: node scripts/e2e/walkthrough.js <outDir> <light|dark>
const path = require('path');
const { chromium } = require('playwright');
const IMG = path.join(__dirname, '../../design/hub/img');
const API_URL = (process.env.API_URL || 'http://localhost:8080').replace(/\/+$/, '');
const WEB_URL = (process.env.WEB_URL || 'http://localhost:8081').replace(/\/+$/, '');
(async () => {
  const [out, scheme] = process.argv.slice(2);
  const tag = Math.random().toString(36).slice(2, 7);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, permissions: ['clipboard-read', 'clipboard-write'] });
  const errors = [];
  let expectNotFound = false; // true while a blocked person's pages are meant to disappear
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !(expectNotFound && /404/.test(m.text()))) errors.push('console: ' + m.text().slice(0, 300)); });
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(API_URL) && !(expectNotFound && r.status() === 404)) errors.push(`http ${r.status()} ${r.request().method()} ${r.url()}`); });
  // Screens underneath the current one stay in the page on the web, so always take the last (topmost) match.
  const T = (...a) => page.getByText(...a).last();
  const R = (...a) => page.getByRole(...a).last();
  const L = (...a) => page.getByLabel(...a).last();
  let n = 0;
  const shot = async (name) => { await page.waitForTimeout(900); n += 1; await page.screenshot({ path: `${out}/${scheme}-${String(n).padStart(2, '0')}-${name}.png` }); console.log('shot', name, page.url()); };
  // A failure names its step and the line of this file that was waiting, and leaves a screenshot.
  const step = async (name, fn) => {
    try {
      await fn();
    } catch (e) {
      await page.screenshot({ path: `${out}/${scheme}-FAILED-${name}.png` }).catch(() => undefined);
      const line = (String(e.stack).match(/walkthrough\.js:(\d+)/) || [])[1];
      // Where the screenshot can't be looked at (a CI log), say what was on the screen and what went wrong on the way.
      const seen = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(-700)).catch(() => '(the page could not be read)');
      console.log(`WHEN IT FAILED the address was ${page.url()}`);
      console.log(`ON THE SCREEN (the end of it): ${seen}`);
      console.log(`ERRORS SO FAR: ${JSON.stringify(errors.slice(-12))}`);
      throw new Error(`${name}${line ? ` (line ${line})` : ''}: ${e.message.split('\n')[0]}`);
    }
  };
  // The web pages the API serves (share pages, legal pages) open in a tab of their own.
  const webShot = async (web, expected, name) => {
    await web.waitForLoadState();
    await web.getByText(expected).first().waitFor();
    n += 1;
    await web.screenshot({ path: `${out}/${scheme}-${String(n).padStart(2, '0')}-${name}.png`, fullPage: true });
    console.log('shot', name, web.url());
  };
  const signedOut = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme });
  const webPage = async (url, expected, name) => {
    const web = await signedOut.newPage();
    await web.goto(url);
    await webShot(web, expected, name);
    await web.close();
  };
  const opened = async (open, expected, name) => {
    const [web] = await Promise.all([page.context().waitForEvent('page'), open()]);
    await webShot(web, expected, name);
    await web.close();
  };
  // The reviewer's queue is a web page of its own, behind the reviewers' password.
  const review = async (fn) => {
    const context = await browser.newContext({ viewport: { width: 900, height: 1000 }, colorScheme: scheme, httpCredentials: { username: 'Walk-through', password: process.env.ADMIN_PASSWORD || 'review' } });
    const queue = await context.newPage();
    try {
      await queue.goto(API_URL + '/admin');
      await queue.getByText('Review queue').waitFor();
      await fn(queue);
    } finally {
      await context.close();
    }
  };
  const api = async (token, method, path, body) => {
    const response = await fetch(API_URL + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`${method} ${path} gave ${response.status}`);
    return response.status === 204 ? null : response.json();
  };

  await step('sign-up', async () => {
    await page.goto(WEB_URL + '/');
    await T('Get started').click({ timeout: 20000 });
    await T('A story, told day by day').waitFor();
    await shot('how-it-works');
    await T('Next', { exact: true }).click();
    await T('Continue with email').click();
    await L('Email', { exact: true }).fill(`nora.${tag}@example.com`);
    await T('Send code').click();
    await L('6-digit code').fill('123456');
    await T('Create your profile').waitFor();
    await L('Name', { exact: true }).fill('Nora Lind');
    await L('Username', { exact: true }).fill(`nora.${tag}`);
    await T('is available').waitFor();
    await L('Bio · optional').fill('Photographer. Slow travel and long walks.');
    // Journey is for people aged 13 and over: Continue waits for the tick, and the terms are one tap away.
    if ((await R('button', { name: 'Continue', exact: true }).getAttribute('aria-disabled')) !== 'true') throw new Error('Continue did not wait for the age confirmation');
    await R('checkbox', { name: "I'm 13 or older" }).click();
    await shot('create-profile');
    await opened(() => T('terms', { exact: true }).click(), 'Terms of use', 'terms-page');
    await T('Continue', { exact: true }).click();
    await T('What are you into?').waitFor();
    for (const name of ['Travel', 'Hiking', 'Photography', 'Music']) await R('checkbox', { name, exact: true }).click();
    await shot('interests');
    await T('Continue · 4 picked').click();
    await T('Follow a few journeys').waitFor();
    await T('Follow', { exact: true }).first().waitFor();
    await R('button', { name: 'Follow', exact: true }).nth(0).click();
    await R('button', { name: 'Follow', exact: true }).nth(0).click();
    await R('button', { name: 'Follow', exact: true }).nth(0).click();
    await shot('suggested');
    await T('Continue', { exact: true }).click();
    // Notifications are asked about once, with a reason. A browser can't have them: the screen says so and sign-up goes on.
    await T("Know when there's a new chapter").waitFor();
    await T('Southeast Asia by motorbike').waitFor();
    await T(/^Notifications arrive on your phone\./).waitFor();
    await shot('notify-ask');
    await T('Continue', { exact: true }).click();
    await T("You're all set, Nora").waitFor();
    await T('Your Home already has 3 journeys to follow').waitFor();
    await shot('ready');
    await T('Maybe later, take me Home').click();
  });

  await step('home', async () => {
    await T('New from journeys you follow').waitFor();
    await T('1 new').first().waitFor();
    await shot('home');
    // Losing the connection shows a calm banner; it goes when the connection is back.
    await page.context().setOffline(true);
    await T("You're offline").waitFor();
    await shot('offline');
    await page.context().setOffline(false);
    await T("You're offline").waitFor({ state: 'detached' });
    await R('tab', { name: 'Travel' }).click();
    await shot('home-travel');
    // Challenges are a tab of their own, whatever they are about; their page says how many there are and
    // can be narrowed to one length.
    await R('tab', { name: 'Challenges' }).click();
    await T('30 days of guitar').first().waitFor();
    await shot('home-challenges');
    await R('button', { name: 'Trending this week. See all' }).click();
    await R('heading', { name: 'Challenges' }).waitFor();
    await T(/^\d[\d,]* in progress · \d[\d,]* finished this month$/).waitFor();
    await T('30 days of guitar').last().waitFor();
    // Narrowed to one length and to what they are about, the page counts again: one of the samples is a
    // 30-day challenge about fitness.
    await R('button', { name: '30 days', exact: true }).click();
    await R('button', { name: 'Fitness', exact: true }).click();
    await T(/^1 in progress · \d[\d,]* finished this month$/).waitFor();
    await T('Learn to surf').last().waitFor();
    await shot('challenges');
    await R('button', { name: 'Back' }).click();
    await R('tab', { name: 'For you' }).click();
    await R('button', { name: /New from journeys you follow/ }).click();
    await T("You're all caught up").waitFor();
    await shot('following');
  });

  await step('entry', async () => {
    await T('Seven lagoons in one day').click();
    await T(/Entry \d+ of \d+/).waitFor();
    await shot('entry');
    await R('button', { name: 'Open the photo full screen' }).click();
    await R('button', { name: 'Close photos' }).waitFor();
    await shot('photo-viewer');
    await R('button', { name: 'Close photos' }).click();
    await R('button', { name: 'Close' }).click();
    await T("You're all caught up").waitFor();
    await R('button', { name: 'Back' }).click();
  });

  await step('discover', async () => {
    await R('tab', { name: 'Discover' }).click();
    await T('Trending now').waitFor();
    // Three rails: what is trending, what is new, and what was just completed.
    await T('New journeys').waitFor();
    await T('Recently completed').waitFor();
    await shot('discover');
    await R('button', { name: 'Food' }).click();
    await T("My grandmother's recipes").first().waitFor();
    await shot('discover-food');
    // With a category chosen, a rail's title leads to that category's own page.
    await R('button', { name: 'Trending now. See all' }).click();
    await R('heading', { name: 'Food' }).waitFor();
    await T("My grandmother's recipes").first().waitFor();
    await shot('category');
    await R('button', { name: 'Back' }).click();
    await R('button', { name: 'Food' }).click();
    await T('Couch to 10K').first().click();
    await T('Read the story').waitFor();
    await shot('journey');
    // Sharing: the same sheet as for an entry, with the link as others will see it; the page behind it opens without signing in.
    await R('button', { name: 'Share this journey' }).click();
    await R('button', { name: 'Copy link' }).waitFor();
    await shot('share-journey');
    await R('button', { name: 'Copy link' }).click();
    await R('button', { name: 'Copied' }).first().waitFor();
    const shared = await page.evaluate(() => navigator.clipboard.readText());
    const sharePage = await fetch(shared);
    if (!sharePage.ok || !(await sharePage.text()).includes('Couch to 10K')) throw new Error('the share page did not open: ' + shared);
    await page.mouse.click(195, 60);
    await R('button', { name: 'Copy link' }).waitFor({ state: 'detached' });
    await R('button', { name: 'Follow', exact: true }).click();
    await T("You follow").waitFor();
    await shot('journey-followed');
    await T('Read the story').click();
    await T('new since your last visit').waitFor();
    await shot('timeline');
    await R('button', { name: 'Back' }).click();
    await R('button', { name: 'Back' }).click();
  });

  let journeyUrl;
  await step('new-journey', async () => {
    await R('button', { name: 'Add an entry or start a journey' }).click();
    await T('Start your first journey').waitFor();
    await shot('plus-sheet-empty');
    await T('Start a new journey').click();
    await T('What kind of journey?').waitFor();
    await T('30-Day Challenge').click();
    await R('button', { name: /^Trip/ }).click();
    await shot('template');
    await T('Continue', { exact: true }).click();
    await T('Tell us about it').waitFor();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), T('Add a cover').click()]);
    await chooser.setFiles(`${IMG}/waterfall.jpg`);
    await T('Change cover').waitFor();
    await L('Title', { exact: true }).fill('Iceland ring road');
    await L("What's it about? · optional").fill('Ten days around the island in a small van.');
    await L('Tags · up to 5').fill('iceland #roadtrip, VanLife');
    await R('button', { name: /^Starts/ }).click();
    await T('When does it start?').waitFor();
    await shot('start-date');
    await R('button', { name: 'Previous month' }).click();
    await R('button', { name: /^28 / }).click();
    await R('button', { name: /^Category/ }).click();
    await T('Category', { exact: true }).last().waitFor();
    await shot('category-sheet');
    await R('button', { name: /Travel$/ }).last().click();
    await shot('details');
    await T('Continue', { exact: true }).click();
    await T('Who can see it?').waitFor();
    await shot('visibility');
    await T('Create journey').click();
    await T('Iceland ring road is live').waitFor({ timeout: 20000 });
    await shot('live');
    journeyUrl = page.url();
  });

  await step('new-entry', async () => {
    await T('Add your first entry').click();
    await T('New entry').waitFor();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), R('button', { name: 'Add photos' }).click()]);
    await chooser.setFiles([`${IMG}/lake.jpg`, `${IMG}/fog.jpg`]);
    await R('button', { name: 'Remove photo 2' }).waitFor();
    await L('Title, optional').fill('Skógafoss before breakfast');
    await T('What surprised you?').click();
    await L('What happened').fill('Nobody else on the path. The spray soaks you from fifty metres away.');
    await R('button', { name: 'Add a place' }).click();
    await T('Where was this?').waitFor();
    await L('Search for a place').fill('skoga');
    await R('button', { name: /^Skógafoss, Iceland/ }).waitFor();
    await shot('place-sheet');
    await R('button', { name: /^Skógafoss, Iceland/ }).click();
    await R('button', { name: /^Place: Skógafoss, Iceland/ }).waitFor();
    // Readers see the area unless the author asks for the exact spot.
    await R('switch', { name: 'Show the exact spot', checked: false }).waitFor();
    await T('2 of 10 photos · 0 of 3 clips').waitFor();
    await R('switch', { name: 'Mark as milestone' }).click();
    await shot('composer');
    await R('button', { name: 'Post' }).click();
    await T('Milestone').first().waitFor({ timeout: 30000 });
    await T('Skógafoss before breakfast').waitFor();
    await shot('own-timeline');
    // Two photos: the second is a swipe away, inside the card.
    await T('1 / 2').waitFor();
    const strip = await L('2 photos. Swipe to see the next one.').evaluate((labelled) => {
      const scrolls = (el) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowX);
      const photos = scrolls(labelled) ? labelled : ([...labelled.querySelectorAll('*')].find(scrolls) ?? labelled);
      photos.scrollLeft = photos.clientWidth;
      return `${photos.scrollWidth} wide in ${photos.clientWidth}, at ${photos.scrollLeft}, overflow ${getComputedStyle(photos).overflowX}`;
    });
    await T('2 / 2').waitFor({ timeout: 8000 }).catch(() => {
      throw new Error('swiping to the second photo did not show "2 / 2": the strip is ' + strip);
    });
    await shot('own-timeline-second-photo');
    await T('Skógafoss before breakfast').click();
    await T('Entry 1 of 1').waitFor();
    await shot('own-entry');
    await R('button', { name: 'Entry options' }).click();
    await T('Share entry').click();
    await T('Share your entry').waitFor();
    await T(/\/e\/[0-9a-f-]{36}/).waitFor();
    await shot('share-entry');
    await R('button', { name: 'Copy link' }).click();
    await R('button', { name: 'Copied' }).first().waitFor();
    const entryLink = await page.evaluate(() => navigator.clipboard.readText());
    await webPage(entryLink, 'Skógafoss before breakfast', 'entry-page');
    await T('Your “Follow my journey” link').click();
    await T(new RegExp(`/u/nora\\.${tag}`)).waitFor();
    await shot('share-profile');
    await webPage(`${API_URL}/u/nora.${tag}`, 'Iceland ring road', 'person-page');
    await page.mouse.click(195, 60);
    await R('button', { name: 'Entry options' }).click();
    await T('Edit entry').waitFor();
    await shot('entry-menu');
    await T('Edit entry').click();
    await T('Edit entry').first().waitFor();
    await L('Title, optional').fill('Skógafoss at sunrise');
    // Leaving with a change asks first: nothing is thrown away by a slip of the thumb.
    await R('button', { name: 'Close' }).click();
    await T('Discard your changes?').waitFor();
    await shot('edit-discard');
    await R('button', { name: 'Keep editing' }).click();
    await R('button', { name: 'Save' }).click();
    await T('Skógafoss at sunrise').first().waitFor({ timeout: 20000 });
    await R('button', { name: 'Close' }).click();
    await T('Skógafoss at sunrise').first().waitFor();
    await R('button', { name: 'Map of this journey' }).click();
    await R('button', { name: /^Stop 1\. .*Skógafoss, Iceland, milestone\. Skógafoss at sunrise/ }).waitFor();
    await T('1 entry · 1 place').waitFor();
    await shot('own-map');
    await R('button', { name: /^Stop 1\./ }).click();
    await T('Entry 1 of 1').waitFor();
    await R('button', { name: 'Close' }).click();
    await R('button', { name: 'Back' }).click();
    await R('button', { name: 'Back' }).click();
  });

  await step('profile', async () => {
    // Closing the story of a journey you just made lands back on the tabs.
    await R('tab', { name: 'Home' }).click();
    await T(/Iceland ring road/).waitFor();
    await shot('home-with-own');
    await R('button', { name: 'Add an entry or start a journey' }).click();
    await T('Add to a journey').waitFor();
    await shot('plus-sheet');
    await page.mouse.click(195, 120);
    await R('tab', { name: 'You' }).click();
    await T('Edit profile').waitFor();
    await T('Photographer. Slow travel and long walks.').waitFor();
    await shot('you');
    await T('Iceland ring road').click();
    await T('Your journey').waitFor();
    await shot('own-journey');
    await R('button', { name: 'Journey options' }).click();
    await T('Pause journey').waitFor();
    await shot('journey-menu');
    await T('Pause journey').click();
    await T('Paused', { exact: true }).waitFor();
    // Paused by hand, so the note doesn't claim 30 quiet days; the owner gets both ways on.
    await T('This journey is paused').waitFor();
    await R('button', { name: 'Add an entry', exact: true }).waitFor();
    await R('button', { name: 'Complete it' }).waitFor();
    await shot('paused');
    await R('button', { name: 'Back' }).click();
    await T('Edit profile').click();
    await L('Link', { exact: true }).waitFor();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), R('button', { name: 'Add a photo' }).click()]);
    await chooser.setFiles(`${IMG}/av-me.jpg`);
    await T('Remove photo').waitFor();
    await L('Link', { exact: true }).fill('noralind.photo');
    await shot('edit-profile');
    await T('Save', { exact: true }).click();
    await T('noralind.photo').waitFor({ timeout: 20000 });
    await shot('you-saved');
    await page.reload();
    await T('Edit profile').waitFor({ timeout: 20000 });
  });

  await step('social', async () => {
    // The sample creators reacted to the entry posted above: two likes, a comment, and one follows along.
    await R('tab', { name: /Activity/ }).click();
    await T(/started following you/).waitFor({ timeout: 20000 });
    await T(/liked/).waitFor();
    await shot('activity');
    await T('This week in the journeys you follow').click();
    await T("That's your week").waitFor();
    await shot('digest');
    await R('button', { name: 'Back' }).click();
    await R('button', { name: 'Follow back' }).click();
    await R('button', { name: 'Follow back' }).waitFor({ state: 'detached', timeout: 20000 });
    await T(/liked/).click();
    await R('button', { name: /^Like\. 2 likes/ }).click();
    await R('button', { name: /^Unlike\. 3 likes/ }).waitFor();
    await shot('entry-liked');
    await R('button', { name: /^Comments\./ }).click();
    await T('1 comment').waitFor();
    await L('Add a comment').fill('Thank you both!');
    await R('button', { name: 'Send comment' }).click();
    await T('2 comments').waitFor();
    await R('button', { name: /^Reply to Nora/ }).waitFor();
    await shot('comments');
    // The word filter holds this one: its author sees it marked, nobody else sees it until a reviewer has read it.
    await L('Add a comment').fill('That last hill was a bitch');
    await R('button', { name: 'Send comment' }).click();
    await T('Only you can see this for now. A person will read it soon.').waitFor();
    await shot('comment-held');
    await R('button', { name: 'Close comments' }).click();
    await R('button', { name: 'Close', exact: true }).click();
    await R('tab', { name: 'Discover' }).click();
    await T('Southeast Asia by motorbike').click();
    await R('button', { name: "Maya Rivera's profile" }).click();
    await T('@maya.rides').waitFor();
    await shot('creator-profile');
    // Maya may be the sample creator who followed back earlier, in which case she is followed already.
    const follow = page.getByRole('button', { name: /^Follow (Maya|back)$/ });
    if (await follow.count()) await follow.last().click();
    await T("You'll get Maya's next journeys.").waitFor();
    await R('button', { name: /follower/ }).click();
    await T('Nora Lind').waitFor();
    await shot('followers');
    // The list can be searched: letters nobody has find nobody, and say so.
    await R('textbox', { name: 'Search followers' }).fill('zzzz');
    await T('Nobody here matches “zzzz”.').waitFor();
    await R('textbox', { name: 'Search followers' }).fill('nora');
    await T('Nora Lind').waitFor();
    await shot('followers-search');
    await R('button', { name: 'Back' }).click();
    await R('button', { name: 'Back' }).click();
    await R('button', { name: 'Back' }).click();
    await R('tab', { name: 'You' }).click();
    await R('button', { name: /1 Followers/ }).waitFor();
    await shot('you-with-followers');
  });

  await step('jump-to', async () => {
    await R('tab', { name: 'Discover' }).click();
    await T('Southeast Asia by motorbike').click();
    await T(/^Read all 5 entries/).click();
    // A day's label stays at the top of the story while that day's entries scroll underneath it.
    await T('Sunrise over Mount Bromo').waitFor();
    const days = page.getByRole('heading', { name: /^(Day|Part) \d+/ });
    // The label that sits just under the bar, if any.
    const atTop = () => days.evaluateAll((labels) => labels.map((label) => ({ says: label.getAttribute('aria-label'), top: label.getBoundingClientRect().top })).find((label) => label.top >= 40 && label.top <= 140)?.says ?? null);
    const first = await atTop();
    await days.first().evaluate((label) => {
      let list = label.parentElement;
      while (list && !['auto', 'scroll'].includes(getComputedStyle(list).overflowY)) list = list.parentElement;
      list.scrollTop = 600;
    });
    await page.waitForTimeout(700);
    const held = await atTop();
    if (!held) throw new Error('no day label is held at the top of the story after scrolling');
    if (held === first) throw new Error('the story did not scroll: the same day label is still at the top');
    await shot('timeline-sticky-day');
    await R('button', { name: 'Jump to' }).click();
    await T('Start from the beginning').waitFor();
    // Every day of the story is one tap away, and so are its highlights, each with its picture.
    await T('Highlights', { exact: true }).waitFor();
    await T('Days', { exact: true }).waitFor();
    await shot('jump-to');
    await T('Newest entry').click();
    await T('Sunrise over Mount Bromo').waitFor();
    await R('button', { name: 'Map of this journey' }).click();
    await T(/^5 entries · \d places?$/).waitFor();
    await R('button', { name: /^Stop 5\..*Mount Bromo/ }).waitFor();
    await shot('map');
    await R('button', { name: 'Back' }).click();
    await R('button', { name: 'Back' }).click();
    await R('button', { name: 'Back' }).click();
    await R('tab', { name: 'You' }).click();
  });

  await step('shared', async () => {
    // The sample creator who follows the new person can be invited; in local mode they accept and add an entry.
    await T('Iceland ring road').click();
    await R('button', { name: 'Journey options' }).click();
    await T('People on this journey').click();
    await T('Add people').waitFor();
    await R('button', { name: 'Invite', exact: true }).waitFor();
    await shot('people-invite');
    await R('button', { name: 'Invite', exact: true }).click();
    await T(/Can add entries/).waitFor({ timeout: 20000 });
    await shot('people');
    // For a friend who isn't on Journey yet: a link that works once. The page behind it opens without signing in.
    await R('button', { name: 'Make an invite link' }).click();
    await T(/\/i\/[a-z2-9]{4}-[a-z2-9]{4}-/).waitFor();
    await shot('invite-link');
    await R('button', { name: 'Copy', exact: true }).click();
    await R('button', { name: 'Copied' }).waitFor();
    const inviteLink = await page.evaluate(() => navigator.clipboard.readText());
    await webPage(inviteLink, 'invited you to add to Iceland ring road', 'invite-page');
    await R('button', { name: 'Back' }).click();
    await T('Shared journey').waitFor();
    await shot('shared-journey');
    await T(/^Read (the story|all)/).click();
    await T('Along for the ride').waitFor();
    await shot('shared-timeline');
    // The story can be narrowed to what one person wrote, and widened again.
    const mine = page.getByRole('button', { name: /^Skógafoss at sunrise$/ });
    const theirs = page.getByRole('button', { name: /^Along for the ride(\. New)?$/ });
    await R('button', { name: 'Everyone', exact: true }).waitFor();
    await page.getByRole('button', { name: /^(?!Nora|Everyone)[^,.]+, 1$/ }).last().click();
    await theirs.last().waitFor();
    await mine.last().waitFor({ state: 'detached' });
    await shot('shared-timeline-one-person');
    await R('button', { name: 'Nora, 1', exact: true }).click();
    await mine.last().waitFor();
    await theirs.last().waitFor({ state: 'detached' });
    await R('button', { name: 'Everyone', exact: true }).click();
    await theirs.last().waitFor();
    await R('button', { name: 'Back' }).click();
    await R('button', { name: 'Back' }).click();
  });

  await step('drafts', async () => {
    // A draft: written, put away, and found again under Drafts and uploads on your own profile.
    await T('Iceland ring road').click();
    await R('button', { name: 'Entry', exact: true }).click();
    await T('New entry').waitFor();
    await L('Title, optional').fill('Notes from the hot spring');
    await R('button', { name: 'Close' }).click();
    await T('Save this for later?').waitFor();
    await shot('save-draft');
    await R('button', { name: 'Save as a draft' }).click();
    await T('Shared journey').waitFor();
    await R('button', { name: 'Back' }).click();
    await R('button', { name: /^Drafts and uploads\. 1 draft/ }).click();
    await T(/^Text only · saved/).waitFor();
    await shot('drafts');
    await R('button', { name: /^Notes from the hot spring/ }).click();
    await T('Draft', { exact: true }).waitFor();
    // Opened and closed without a change: no question, and it is still there.
    await R('button', { name: 'Close' }).click();
    await T(/^Text only · saved/).waitFor();
    await R('button', { name: /^Notes from the hot spring/ }).click();
    await T('Draft', { exact: true }).waitFor();
    await L('What happened').fill('Forty degrees in the water, four outside.');
    // Without a connection the entry is kept on the phone. It goes up by itself, once, when the connection is back.
    await page.context().setOffline(true);
    await T(/^You.re offline\. Post it anyway/).waitFor();
    await shot('composer-offline');
    await R('button', { name: 'Post' }).click();
    await T(/^Saved: "Notes from the hot spring"/).waitFor();
    await shot('story-entry-waiting');
    await R('button', { name: /Open drafts and uploads/ }).click();
    await T('Waiting to upload').waitFor();
    await T('Waiting for a connection').waitFor();
    await shot('uploads-offline');
    await page.context().setOffline(false);
    await T('Nothing waiting').waitFor({ timeout: 30000 });
    await R('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: /^Notes from the hot spring$/ }).last().waitFor({ timeout: 20000 });
    await T(/^(Saved|Posting): "Notes/).waitFor({ state: 'detached' });
    await shot('story-after-offline');
    // Posted once: the story has the entry a single time.
    if ((await page.getByRole('button', { name: /^Notes from the hot spring$/ }).count()) !== 1) throw new Error('the offline entry is in the story more than once');
    await R('button', { name: 'Back' }).click();
    await T('Nothing waiting').waitFor();
    await R('button', { name: 'Back' }).click();
    await T('Edit profile').waitFor();
  });

  await step('clip', async () => {
    // A short clip to attach. The browser records one of a plain page: Chromium plays WebM, and has no camera roll.
    const recorder = await browser.newContext({ recordVideo: { dir: path.join(out, 'clip'), size: { width: 320, height: 240 } } });
    const stage = await recorder.newPage();
    await stage.setContent('<body style="margin:0;background:#FFC21A"><h1 style="font:700 40px sans-serif;padding:80px 40px">Journey</h1></body>');
    await stage.waitForTimeout(1600);
    const recording = stage.video();
    await recorder.close();
    const clip = await recording.path();
    await T('Iceland ring road').click();
    await R('button', { name: 'Entry', exact: true }).click();
    await T('New entry').waitFor();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), R('button', { name: 'Add photos or clips' }).click()]);
    await chooser.setFiles(clip);
    await R('button', { name: 'Remove clip 1' }).waitFor();
    await T('0 of 10 photos · 1 of 3 clips').waitFor();
    await L('Title, optional').fill('Steam off the river');
    await shot('composer-clip');
    await R('button', { name: 'Post' }).click();
    await page.getByRole('button', { name: /^Steam off the river$/ }).last().waitFor({ timeout: 30000 });
    await shot('story-with-clip');
    await page.getByRole('button', { name: /^Steam off the river$/ }).last().click();
    await R('button', { name: 'Open the clip full screen' }).click();
    // A clip never plays by itself: its still and a play button, until it is tapped.
    await T(/^Tap to play/).waitFor();
    if (await page.locator('video').count()) throw new Error('a clip was loaded before anyone tapped play');
    await shot('clip');
    await R('button', { name: /^Play the clip/ }).click();
    await page.locator('video').last().waitFor();
    await page.waitForFunction(() => { const all = document.querySelectorAll('video'); const v = all[all.length - 1]; return !!v && v.currentTime > 0; }, null, { timeout: 15000 });
    await shot('clip-playing');
    await R('button', { name: 'Close photos' }).click();
    await R('button', { name: 'Close', exact: true }).click();
    await R('button', { name: 'Back' }).click();
    await R('button', { name: 'Back' }).click();
    await T('Edit profile').waitFor();
  });

  // A second person, made through the API, invites the new person to their journey.
  let host;
  await step('invited', async () => {
    host = (await api(null, 'POST', '/local-auth/token', { email: `alex.${tag}@example.com`, code: '123456' })).accessToken;
    const profile = { displayName: 'Alex Strand', username: `alex.${tag}` };
    const unconfirmed = await fetch(API_URL + '/v1/me/profile', { method: 'PUT', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + host }, body: JSON.stringify(profile) });
    if (unconfirmed.status !== 400 || (await unconfirmed.json()).code !== 'age_required') throw new Error('the API made a profile without the age confirmation');
    await api(host, 'PUT', '/v1/me/profile', { ...profile, ageConfirmed: true });
    await R('tab', { name: 'Home' }).click();
    await R('button', { name: 'Find a journey' }).click();
    await R('textbox', { name: 'Search journeys, people and tags' }).fill(`alex.${tag}`);
    await R('tab', { name: /^People/ }).click();
    await R('button', { name: 'Follow', exact: true }).click();
    await R('button', { name: 'Following' }).waitFor();
    await T('Cancel').click();
    const journey = await api(host, 'POST', '/v1/journeys', { title: 'Faroe ferry', template: 'trip', startDate: new Date().toISOString().slice(0, 10), visibility: 'public' });
    await api(host, 'POST', `/v1/journeys/${journey.id}/members`, { username: `nora.${tag}` });
    await R('tab', { name: /Activity/ }).click();
    await T(/invited you to add to/).waitFor({ timeout: 20000 });
    await T(/invited you to add to/).click();
    await T('Add to Faroe ferry?').waitFor();
    await shot('invitation');
    await R('button', { name: 'Join the journey' }).click();
    await T('You write in this journey').waitFor({ timeout: 20000 });
    await shot('joined-journey');
  });

  await step('held-photo', async () => {
    // The local photo check flags a photo that is one solid magenta. Its owner sees it hidden, with what happens next.
    const magenta = Buffer.from(
      await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        const g = canvas.getContext('2d');
        g.fillStyle = '#ff00ff';
        g.fillRect(0, 0, 800, 600);
        return canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
      }),
      'base64',
    );
    await R('button', { name: 'Entry', exact: true }).click();
    await T('New entry').waitFor();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), R('button', { name: 'Add photos' }).click()]);
    await chooser.setFiles([
      { name: 'sea-cave.jpg', mimeType: 'image/jpeg', buffer: require('fs').readFileSync(`${IMG}/sea-cave.jpg`) },
      { name: 'magenta.jpg', mimeType: 'image/jpeg', buffer: magenta },
    ]);
    await R('button', { name: 'Remove photo 2' }).waitFor();
    await L('Title, optional').fill('Black sand and big waves');
    await L('What happened').fill('Stood far back from the water, as the signs say. The waves still made it to my boots.');
    await R('button', { name: 'Add a place' }).click();
    await L('Search for a place').fill('skoga');
    await R('button', { name: /^Skógafoss, Iceland/ }).click();
    await R('button', { name: /^Place: Skógafoss, Iceland/ }).waitFor();
    await R('button', { name: 'Post' }).click();
    // The story also says "Posting …" in a banner while the photos go up, so ask for the entry's own row.
    const posted = page.getByRole('button', { name: /^Black sand and big waves$/ }).last();
    await posted.waitFor({ timeout: 30000 });
    await posted.click();
    await T('One photo is being reviewed').waitFor();
    await shot('entry-held');
    await T('One photo is being reviewed').click();
    await T('Hidden for now').waitFor();
    await T("Our automatic check flagged it, so it's hidden from everyone but you. A person will look at it soon.").waitFor();
    await shot('held-for-review');
    await T('Ask for a second look').click();
    await T("Thanks. We'll take a second look.").waitFor();
    // Nobody else gets the photo: the entry's own web page shows one picture, not two.
    const entryId = page.url().split('/review/')[1];
    const publicPage = await (await fetch(`${API_URL}/e/${entryId}`)).text();
    if ((publicPage.match(/<img class="shot"/g) || []).length !== 1) throw new Error('the held photo is on the public page');

    // The reviewer sees what waits: the photo (asked about again) and the comment from before.
    await review(async (queue) => {
      await queue.getByText('Asked for a second look').first().waitFor();
      const comment = queue.locator('section.item', { hasText: 'That last hill was a bitch' }).filter({ hasText: `@nora.${tag},` });
      await comment.waitFor();
      n += 1;
      await queue.screenshot({ path: `${out}/${scheme}-${String(n).padStart(2, '0')}-review-queue.png`, fullPage: true });
      console.log('shot', 'review-queue', queue.url());
      await comment.getByRole('button', { name: "It's fine, show it" }).click();
      await queue.getByText('released a comment').first().waitFor();
    });

    await R('button', { name: 'Remove the photo' }).click();
    await T('Entry 1 of 1').waitFor({ timeout: 20000 });
    await T('One photo is being reviewed').waitFor({ state: 'detached' });
    await shot('entry-photo-removed');
    // Only the photo went: the entry still has its place, with the spot on the map.
    const me = (await api(null, 'POST', '/local-auth/token', { email: `nora.${tag}@example.com`, code: '123456' })).accessToken;
    const kept = await api(me, 'GET', `/v1/entries/${entryId}`);
    if (kept.placeName !== 'Skógafoss, Iceland' || kept.lat == null || kept.lng == null) throw new Error('removing the held photo took the place with it');
    if (kept.media.length !== 1) throw new Error('the held photo is still on the entry');
    // The photo is off the entry but still waiting; the reviewer clears it away.
    await review(async (queue) => {
      await queue.locator('section.item.photo', { hasText: `@nora.${tag} ` }).getByRole('button', { name: 'Remove the photo' }).click();
      await queue.getByText('removed a photo').first().waitFor();
    });
    await R('button', { name: 'Close', exact: true }).click();
    await R('button', { name: 'Back' }).click();
    await T('You write in this journey').waitFor();
    await R('button', { name: 'Back' }).click();
  });

  await step('search', async () => {
    await R('tab', { name: 'Home' }).click();
    await R('button', { name: 'Find a journey' }).click();
    await T('Popular tags').waitFor();
    await shot('search-start');
    await R('textbox', { name: 'Search journeys, people and tags' }).fill('asia');
    await T('Southeast Asia by motorbike').waitFor();
    await shot('search-results');
    // A place is found by its name; tapping it shows the journeys that were there.
    await R('textbox', { name: 'Search journeys, people and tags' }).fill('hoi an');
    await R('tab', { name: /^Places/ }).click();
    await R('button', { name: /^Search for journeys in Hoi An, Vietnam/ }).waitFor();
    await shot('search-places');
    await R('button', { name: /^Search for journeys in Hoi An, Vietnam/ }).click();
    await T('Southeast Asia by motorbike').waitFor();
    await R('textbox', { name: 'Search journeys, people and tags' }).fill('@lea');
    await R('tab', { name: /^People/ }).click();
    await T('@lea.plays').waitFor();
    await shot('search-people');
    await T('Cancel').click();
  });

  await step('settings', async () => {
    await R('tab', { name: 'You' }).click();
    await R('button', { name: 'Settings' }).click();
    await R('button', { name: /^Notifications\. 6 of 8 on/ }).waitFor();
    await shot('settings');
    await opened(() => R('button', { name: 'Help and contact' }).click(), 'Contact', 'contact-page');
    await opened(() => R('button', { name: 'Community guidelines' }).click(), 'Community guidelines', 'guidelines-page');
    await opened(() => R('button', { name: 'Privacy policy' }).click(), 'Privacy', 'privacy-page');
    await webPage(API_URL + '/delete-account', 'Ask to delete my account', 'delete-account-page');
    await R('button', { name: /^Notifications/ }).click();
    await R('switch', { name: 'Likes' }).click();
    await R('switch', { name: 'Likes', checked: false }).waitFor();
    await T('In one batch, at most once an hour').waitFor();
    await T(/^Notifications arrive on your phone\./).waitFor();
    await shot('notification-settings');
    // Reminders arrive at the hour the person chooses.
    await R('button', { name: /^Challenge check-in time\. 7:00 pm/ }).click();
    await T('8:00 pm').waitFor();
    await shot('reminder-time');
    await R('button', { name: '8:00 pm', exact: true }).click();
    await R('button', { name: /^Challenge check-in time\. 8:00 pm/ }).waitFor();
    await R('button', { name: 'Back' }).click();
    await R('button', { name: /^Notifications\. 5 of 8 on/ }).waitFor();
    await R('button', { name: /^Privacy and safety/ }).click();
    await R('button', { name: /^Start them as/ }).click();
    await T('Only you and friends you invite.').click();
    await R('button', { name: /^Start them as\. Private/ }).waitFor();
    await shot('privacy');
    await R('button', { name: 'Back' }).click();
    await R('button', { name: /^Appearance/ }).click();
    await R('button', { name: /^Dark/ }).click();
    await shot('appearance-dark');
    await R('button', { name: /^Automatic/ }).click();
    await R('button', { name: 'Back' }).click();
    await R('button', { name: 'Back' }).click();
  });

  await step('complete', async () => {
    await T('Iceland ring road').click();
    await R('button', { name: 'Journey options' }).click();
    await T('Complete journey').click();
    await T('How did it end?').waitFor();
    await L(/^Closing note/).fill('Fourteen days, one waterfall, no regrets.');
    await shot('complete');
    await R('button', { name: 'Complete journey' }).click();
    await T('Journey complete').waitFor({ timeout: 20000 });
    await shot('recap');
    // The recap can be shared: the same sheet as for a journey, with what it added up to.
    await R('button', { name: 'Share recap' }).click();
    await T('Share the recap').waitFor();
    await R('button', { name: 'Copy link' }).waitFor();
    await shot('share-recap');
    await page.mouse.click(195, 60);
    await R('button', { name: 'Copy link' }).waitFor({ state: 'detached' });
    await R('button', { name: 'Close' }).click();
    await T('See the recap').waitFor();
    await shot('completed-journey');
    await R('button', { name: 'Back' }).click();
  });

  await step('safety', async () => {
    await R('tab', { name: 'Discover' }).click();
    await T('30 days of guitar').click();
    await T(/of 30 days/).waitFor();
    await shot('challenge');
    await R('button', { name: 'Journey options' }).click();
    await T('Report this journey').click();
    await R('radio', { name: 'Spam or a scam' }).click();
    await shot('report');
    await R('button', { name: 'Send report' }).click();
    await T('Thanks for telling us').waitFor();
    await R('button', { name: 'Done' }).click();
    // Reported, the journey leaves Discover and search until a reviewer has looked. Here the reviewer finds nothing wrong.
    const hidden = await api(host, 'GET', '/v1/search?q=guitar');
    if (hidden.journeys.some((j) => j.title === '30 days of guitar')) throw new Error('a reported journey is still in search');
    await review(async (queue) => {
      const report = queue.locator('section.item', { hasText: '30 days of guitar' }).filter({ hasText: `Reported by @nora.${tag}.` });
      await report.getByRole('button', { name: 'Nothing wrong, keep it' }).click();
      await queue.getByText('dismissed a report').first().waitFor();
    });
    const back = await api(host, 'GET', '/v1/search?q=guitar');
    if (!back.journeys.some((j) => j.title === '30 days of guitar')) throw new Error('the journey did not come back after the report was dismissed');
    await R('button', { name: "Lea Martin's profile" }).click();
    await T('@lea.plays').waitFor();
    await R('button', { name: 'More options' }).click();
    await T('Block Lea').click();
    await T("They won't be told").waitFor();
    await shot('block');
    expectNotFound = true;
    await R('button', { name: 'Block', exact: true }).click();
    await T("This journey isn't available.").waitFor({ timeout: 20000 });
    await R('button', { name: 'Back' }).click();
    expectNotFound = false;
    await R('tab', { name: 'You' }).click();
    await R('button', { name: 'Settings' }).click();
    await R('button', { name: /^Privacy and safety/ }).click();
    await R('button', { name: /^Blocked accounts\. 1/ }).click();
    await T('@lea.plays', { exact: false }).waitFor();
    await shot('blocked');
    await R('button', { name: 'Unblock' }).click();
    await T("You haven't blocked anyone.").waitFor({ timeout: 20000 });
    await R('button', { name: 'Back' }).click();
    await page.waitForURL((url) => url.pathname === '/settings/privacy');
    await R('button', { name: 'Back' }).click();
    // Going back is not instant: wait until it has landed, or it lands on top of whatever the next step opens.
    await page.waitForURL((url) => url.pathname === '/settings');
  });

  // [foundations] A link that opens the app cold, an address the app doesn't know, and a cold start without a
  // connection. Each of them loads the app afresh, so this comes after everything that reads what was loaded
  // before. For "no connection" the app's own files are still on the phone (this script answers for them)
  // and everything else is gone.
  await step('offline-start', async () => {
    const mine = await page.evaluate(() => localStorage.getItem('journey.session'));
    const notebook = await api(mine, 'POST', '/v1/journeys', { title: 'Notes without a signal', template: 'trip', startDate: new Date().toISOString().slice(0, 10), visibility: 'public' });
    // Opened straight onto a story, as a link or a notification does: the tabs are underneath, so Back lands on Home.
    await page.goto(`${WEB_URL}/journey/${notebook.id}/timeline`);
    await T('Notes without a signal').waitFor({ timeout: 20000 });
    await R('button', { name: 'Back' }).click();
    await R('button', { name: 'Find a journey' }).waitFor();
    // An address the app has no screen for says so in its own words, and offers Home.
    await page.goto(`${WEB_URL}/nothing/here`);
    await T("There's nothing at this address").waitFor({ timeout: 20000 });
    await shot('not-found');
    await R('button', { name: 'Go to Home' }).click();
    await R('button', { name: 'Find a journey' }).waitFor();
    // The journey is read once with a connection. A moment later the phone has its own copy of what was read.
    await R('tab', { name: 'You' }).click();
    await T('Notes without a signal', { exact: true }).click();
    await T('Your journey').waitFor();
    await page.waitForFunction((id) => { const kept = localStorage.getItem('journey.kept.v1') || ''; return kept.includes(`/v1/journeys/${id}/summary`) && kept.includes('/v1/feed'); }, notebook.id, { timeout: 15000 });

    const installed = async (route) => {
      const file = await fetch(route.request().url());
      await route.fulfill({ status: file.status, headers: { 'content-type': file.headers.get('content-type') || 'application/octet-stream' }, body: Buffer.from(await file.arrayBuffer()) });
    };
    // (A page this script answered for counts as "from elsewhere" to the browser, which then wants a
    // permission before that page may talk to an API on this computer again, once it is back online.)
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write', 'local-network-access']);
    await page.route(`${WEB_URL}/**`, installed);
    const errorsBefore = errors.length;
    await page.context().setOffline(true);
    await page.goto(`${WEB_URL}/`);
    // The app opens on Home with what was read, and says it is offline in a strip that covers nothing.
    await R('button', { name: 'Find a journey' }).waitFor({ timeout: 20000 });
    await T("You're offline").waitFor();
    if (await page.getByText("We can't reach Journey").count()) throw new Error('the app says it cannot be reached although it opened from what the phone kept');
    await shot('offline-start-home');
    // A screen with a photo on top: the strip is dark there.
    await R('tab', { name: 'You' }).click();
    await T('Notes without a signal', { exact: true }).click();
    await T('Your journey').waitFor();
    await shot('offline-journey');
    // The composer opens for a journey the phone knows. It says "offline" in its own words, so the strip stays away.
    await R('button', { name: 'Entry', exact: true }).click();
    await T('New entry').waitFor();
    await T(/^You.re offline\. Post it anyway/).waitFor();
    if (await page.getByText("Showing what's saved on this phone").count()) throw new Error('the offline strip is on the composer, which says it already');
    await L('Title, optional').fill('Written in a tunnel');
    await shot('offline-composer');
    await R('button', { name: 'Post' }).click();
    await T(/^Saved: "Written in a tunnel"/).waitFor();
    await T("You're offline").waitFor();
    await shot('offline-story');
    await R('button', { name: /Open drafts and uploads/ }).click();
    await T('Waiting to upload').waitFor();
    await T('Waiting for a connection').waitFor();
    await shot('offline-uploads');
    // Back online, what was written goes up by itself.
    await page.context().setOffline(false);
    await page.unroute(`${WEB_URL}/**`, installed);
    // Pictures that couldn't load without a connection are not errors of the app.
    for (let i = errors.length - 1; i >= errorsBefore; i -= 1) if (/ERR_INTERNET_DISCONNECTED/.test(errors[i])) errors.splice(i, 1);
    await T('Nothing waiting').waitFor({ timeout: 30000 });
    await R('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: /^Written in a tunnel$/ }).last().waitFor({ timeout: 20000 });
  });

  await step('invite-link', async () => {
    // A third person sends the new person a one-time link. Opening it in the app shows the invitation; yes joins.
    // (Opening a link loads the app afresh, which is why this comes after everything that reads what was loaded before.)
    const friend = (await api(null, 'POST', '/local-auth/token', { email: `theo.${tag}@example.com`, code: '123456' })).accessToken;
    await api(friend, 'PUT', '/v1/me/profile', { displayName: 'Theo Brandt', username: `theo.${tag}`, ageConfirmed: true });
    const journey = await api(friend, 'POST', '/v1/journeys', { title: 'Lofoten by bike', template: 'trip', startDate: new Date().toISOString().slice(0, 10), visibility: 'private' });
    const link = (await api(friend, 'POST', `/v1/journeys/${journey.id}/invite-link`)).url;
    const token = link.split('/i/')[1];
    await page.goto(`${WEB_URL}/invite/${token}`);
    await T('Add to Lofoten by bike?').waitFor({ timeout: 20000 });
    await T('Theo Brandt invited you').waitFor();
    await shot('link-invitation');
    await R('button', { name: 'Join the journey' }).click();
    await T('You write in this journey').waitFor({ timeout: 20000 });
    await shot('joined-by-link');
    // It worked once: the page behind the link now says so, and so does the app.
    if ((await fetch(link)).status !== 410) throw new Error('the invite link still works after it was used');
    expectNotFound = true;
    await page.goto(`${WEB_URL}/invite/${token}`);
    await T('This invitation link has been used or has run out. Ask your friend for a new one.').waitFor({ timeout: 20000 });
    await shot('link-invitation-used');
    expectNotFound = false;
    await api(friend, 'DELETE', '/v1/me');
    await page.goto(WEB_URL + '/');
    await R('tab', { name: 'You' }).click({ timeout: 20000 });
    await R('button', { name: 'Settings' }).click();
  });

  await step('delete-account', async () => {
    await R('button', { name: /^Account/ }).click();
    await R('button', { name: 'Delete account' }).click();
    await T('Delete your account?').waitFor();
    await shot('delete-account');
    await R('button', { name: 'Delete my account' }).click();
    await T('Get started').waitFor({ timeout: 20000 });
    await shot('after-delete');
    if (host) await api(host, 'DELETE', '/v1/me');
  });

  console.log('errors', JSON.stringify(errors.slice(0, 10), null, 1));
  await browser.close();
})().catch(e => { console.error('FLOW FAILED:', e.message); process.exit(1); });
