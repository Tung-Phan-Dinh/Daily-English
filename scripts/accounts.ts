// Creates (or updates) the app's only three accounts and links them.
// Sign-ups are disabled, so these are the only accounts that can exist.
//
// Passwords are NOT stored in the repo. Set them in the environment:
//   ACCOUNT_ADMIN_EMAIL / ACCOUNT_ADMIN_PASSWORD      (admin)
//   ACCOUNT_PARENT_EMAIL / ACCOUNT_PARENT_PASSWORD    (family viewer)
//   ACCOUNT_LEARNER_EMAIL / ACCOUNT_LEARNER_PASSWORD  (the learner)
//
// Local:       node --env-file=.env.local scripts/accounts.ts
// Production:  node --env-file=.env.production.local scripts/accounts.ts
// Add --prune to delete any other auth users (asks no questions — use with care).

import { admin } from "./_shared.ts";

const db = admin();

type Account = { key: string; email: string; password: string; role: "admin" | "viewer" | "learner"; display_name: string; timezone: string; ui_lang: "en" | "vi" };

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Set ${name}`);
  return v;
}

const ACCOUNTS: Account[] = [
  { key: "admin", email: process.env.ACCOUNT_ADMIN_EMAIL ?? "admin@dailyenglish.app", password: need("ACCOUNT_ADMIN_PASSWORD"), role: "admin", display_name: "Admin", timezone: "Australia/Melbourne", ui_lang: "en" },
  { key: "parent", email: process.env.ACCOUNT_PARENT_EMAIL ?? "parent@dailyenglish.app", password: need("ACCOUNT_PARENT_PASSWORD"), role: "viewer", display_name: "Mẹ", timezone: "Australia/Melbourne", ui_lang: "vi" },
  { key: "learner", email: process.env.ACCOUNT_LEARNER_EMAIL ?? "hung@dailyenglish.app", password: need("ACCOUNT_LEARNER_PASSWORD"), role: "learner", display_name: "Hưng", timezone: "Asia/Ho_Chi_Minh", ui_lang: "en" },
];

async function allUsers() {
  const users: { id: string; email?: string }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 200) return users;
  }
}

async function upsert(a: Account, existing: { id: string; email?: string }[]) {
  let id = existing.find((u) => u.email?.toLowerCase() === a.email.toLowerCase())?.id;
  if (id) {
    const { error } = await db.auth.admin.updateUserById(id, { password: a.password, email_confirm: true });
    if (error) throw new Error(`${a.email}: ${error.message}`);
  } else {
    const { data, error } = await db.auth.admin.createUser({ email: a.email, password: a.password, email_confirm: true });
    if (error) throw new Error(`${a.email}: ${error.message}`);
    id = data.user.id;
  }
  // Keep a name/language the user changed in Settings; always enforce role.
  const { data: prof } = await db.from("profiles").select("display_name, ui_lang, timezone").eq("id", id).maybeSingle();
  const keepName = prof?.display_name && !prof.display_name.includes("@") && prof.display_name !== a.email.split("@")[0];
  await db.from("profiles").upsert({
    id,
    role: a.role,
    display_name: keepName ? prof!.display_name : a.display_name,
    ui_lang: prof?.ui_lang ?? a.ui_lang,
    timezone: prof?.timezone ?? a.timezone, // the admin can change it later
  });
  await db.from("settings").upsert({ user_id: id }, { onConflict: "user_id", ignoreDuplicates: true });
  return id;
}

const existing = await allUsers();
const ids: Record<string, string> = {};
for (const a of ACCOUNTS) ids[a.key] = await upsert(a, existing);

await db.from("family_links").upsert(
  [
    { viewer_id: ids.parent, learner_id: ids.learner },
    { viewer_id: ids.admin, learner_id: ids.learner },
  ],
  { ignoreDuplicates: true },
);

if (process.argv.includes("--prune")) {
  const keep = new Set(Object.values(ids));
  for (const u of existing) {
    if (keep.has(u.id)) continue;
    const { error } = await db.auth.admin.deleteUser(u.id);
    console.log(error ? `could not delete ${u.email}: ${error.message}` : `deleted ${u.email}`);
  }
}

for (const a of ACCOUNTS) console.log(`${a.role.padEnd(7)} ${a.email}`);
console.log("Accounts ready. Passwords were taken from the environment and are not printed.");
