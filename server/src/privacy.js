// Helpers that keep student contact details out of public responses.

const ADJECTIVES = [
  'Amber', 'Azure', 'Brisk', 'Calm', 'Coral', 'Crimson', 'Dusky', 'Emerald', 'Gentle', 'Golden',
  'Indigo', 'Ivory', 'Jade', 'Keen', 'Lively', 'Lunar', 'Maple', 'Misty', 'Olive', 'Quiet',
  'Rapid', 'Rustic', 'Saffron', 'Silver', 'Solar', 'Steady', 'Teal', 'Tidy', 'Velvet', 'Witty',
];
const ANIMALS = [
  'Badger', 'Bison', 'Crane', 'Dolphin', 'Falcon', 'Finch', 'Gecko', 'Heron', 'Ibis', 'Jackal',
  'Kestrel', 'Koala', 'Lynx', 'Macaw', 'Marten', 'Mongoose', 'Otter', 'Owl', 'Panda', 'Peacock',
  'Puffin', 'Robin', 'Sparrow', 'Stork', 'Tapir', 'Tiger', 'Turtle', 'Wren', 'Yak', 'Zebra',
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Generate a unique, friendly pseudonym such as "Teal Heron 42". */
export function generateAlias(isTaken) {
  for (let i = 0; i < 50; i++) {
    const alias = `${pick(ADJECTIVES)} ${pick(ANIMALS)} ${10 + Math.floor(Math.random() * 90)}`;
    if (!isTaken(alias)) return alias;
  }
  return `Student ${Date.now().toString(36).toUpperCase()}`;
}

/** 24BCE2353 -> 24•••••53 (keeps the batch year only, plus two check digits). */
export const maskRegNo = (regNo = '') =>
  regNo.length < 4 ? '•••••' : `${regNo.slice(0, 2)}${'•'.repeat(regNo.length - 4)}${regNo.slice(-2)}`;

/** naresh.n2024@vitstudent.ac.in -> n•••••@vitstudent.ac.in */
export const maskEmail = (email = '') => {
  const [local, domain] = email.split('@');
  if (!domain) return '•••••';
  return `${local.slice(0, 1)}•••••@${domain}`;
};

/** 9876543210 -> ••••••••10 */
export const maskPhone = (phone) => (phone ? `${'•'.repeat(phone.length - 2)}${phone.slice(-2)}` : null);

/** The only shape in which another student's identity ever leaves the API. */
export const publicPerson = (row, prefix = '') => ({
  alias: row[`${prefix}alias`],
  regNo: maskRegNo(row[`${prefix}reg_no`]),
  email: maskEmail(row[`${prefix}email`]),
  phone: row[`${prefix}phone`] ? maskPhone(row[`${prefix}phone`]) : null,
});

// Detects phone numbers / emails typed into free text so they can be blocked.
const PHONE_RE = /(?:\+?91[\s-]?)?(?:\d[\s-]?){10}/;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export function containsContactInfo(text = '') {
  return PHONE_RE.test(text) || EMAIL_RE.test(text);
}

export const CONTACT_INFO_MESSAGE =
  'For your safety, phone numbers and email addresses can’t be shared here. Agree on a campus checkpoint in the handoff thread instead.';
