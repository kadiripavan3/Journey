// Walks through the app the way a new person would, in the web build, against the local API:
// sign-up, following, Home, Discover, a journey and its story, starting a journey, posting and
// editing an entry with photos, the profile, Activity, likes, comments, following a creator, search,
// the weekly digest, sharing a link, shared journeys (inviting a friend, and being invited), settings, completing a journey, reporting,
// blocking, and at the end deleting the account.
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
  const step = async (name, fn) => { try { await fn(); } catch (e) { await page.screenshot({ path: `${out}/${scheme}-FAILED-${name}.png` }); throw new Error(`${name}: ${e.message.split('\n')[0]}`); } };

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
    await shot('create-profile');
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
    await shot('discover');
    await R('button', { name: 'Food' }).click();
    await T("My grandmother's recipes").first().waitFor();
    await shot('discover-food');
    await R('button', { name: 'Food' }).click();
    await T('Couch to 10K').first().click();
    await T('Read the story').waitFor();
    await shot('journey');
    // Sharing: a browser has no share sheet, so the link is copied; the page behind it opens without signing in.
    await R('button', { name: 'Share this journey' }).click();
    await T('Link copied').waitFor();
    const shared = await page.evaluate(() => navigator.clipboard.readText());
    const sharePage = await fetch(shared);
    if (!sharePage.ok || !(await sharePage.text()).includes('Couch to 10K')) throw new Error('the share page did not open: ' + shared);
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
    await L('Place, optional').fill('Skógafoss, Iceland');
    await R('switch', { name: 'Mark as milestone' }).click();
    await shot('composer');
    await R('button', { name: 'Post' }).click();
    await T('Milestone').first().waitFor({ timeout: 30000 });
    await T('Skógafoss before breakfast').waitFor();
    await shot('own-timeline');
    await T('Skógafoss before breakfast').click();
    await T('Entry 1 of 1').waitFor();
    await shot('own-entry');
    await R('button', { name: 'Entry options' }).click();
    await T('Edit entry').waitFor();
    await shot('entry-menu');
    await T('Edit entry').click();
    await T('Edit entry').first().waitFor();
    await L('Title, optional').fill('Skógafoss at sunrise');
    await R('button', { name: 'Save' }).click();
    await T('Skógafoss at sunrise').first().waitFor({ timeout: 20000 });
    await R('button', { name: 'Close' }).click();
    await T('Skógafoss at sunrise').first().waitFor();
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
    await R('button', { name: 'Jump to' }).click();
    await T('Start from the beginning').waitFor();
    await shot('jump-to');
    await T('Newest entry').click();
    await T('Sunrise over Mount Bromo').waitFor();
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
    await R('button', { name: 'Invite' }).waitFor();
    await shot('people-invite');
    await R('button', { name: 'Invite' }).click();
    await T(/Can add entries/).waitFor({ timeout: 20000 });
    await shot('people');
    await R('button', { name: 'Back' }).click();
    await T('Shared journey').waitFor();
    await shot('shared-journey');
    await T(/^Read (the story|all)/).click();
    await T('Along for the ride').waitFor();
    await shot('shared-timeline');
    await R('button', { name: 'Back' }).click();
    await R('button', { name: 'Back' }).click();
  });

  // A second person, made through the API, invites the new person to their journey.
  const api = async (token, method, path, body) => {
    const response = await fetch(API_URL + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`${method} ${path} gave ${response.status}`);
    return response.status === 204 ? null : response.json();
  };
  let host;
  await step('invited', async () => {
    host = (await api(null, 'POST', '/local-auth/token', { email: `alex.${tag}@example.com`, code: '123456' })).accessToken;
    await api(host, 'PUT', '/v1/me/profile', { displayName: 'Alex Strand', username: `alex.${tag}` });
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
    await R('textbox', { name: 'Search journeys, people and tags' }).fill('@lea');
    await R('tab', { name: /^People/ }).click();
    await T('@lea.plays').waitFor();
    await shot('search-people');
    await T('Cancel').click();
  });

  await step('settings', async () => {
    await R('tab', { name: 'You' }).click();
    await R('button', { name: 'Settings' }).click();
    await R('button', { name: /^Notifications\. 7 of 8 on/ }).waitFor();
    await shot('settings');
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
    await R('button', { name: /^Notifications\. 6 of 8 on/ }).waitFor();
    await R('button', { name: /^Privacy and safety/ }).click();
    await R('button', { name: /^Start them as/ }).click();
    await T('Only you.').click();
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
    await R('button', { name: 'Back' }).click();
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
