import { z } from 'zod';
import { CATEGORIES, CHECKPOINTS, ITEM_TYPES, VENUES } from './constants.js';
import { badRequest } from './errors.js';
import { CONTACT_INFO_MESSAGE, containsContactInfo } from './privacy.js';

const trimmed = (min, max, label) =>
  z
    .string({ required_error: `${label} is required.`, invalid_type_error: `${label} must be text.` })
    .trim()
    .min(min, min <= 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

const optionalTrimmed = (max, label) =>
  z
    .string({ invalid_type_error: `${label} must be text.` })
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const noContactInfo = (schema) =>
  schema.refine((v) => !v || !containsContactInfo(v), { message: CONTACT_INFO_MESSAGE });

export const REG_NO_RE = /^\d{2}[A-Z]{3}\d{4}$/;
export const VIT_EMAIL_RE = /^[a-z0-9._%+-]+@(vitstudent\.ac\.in|vit\.ac\.in)$/i;
export const PHONE_RE = /^[6-9]\d{9}$/;

export const registerSchema = z.object({
  name: trimmed(2, 80, 'Name').regex(/^[\p{L} .'-]+$/u, 'Name can contain letters, spaces, dots and hyphens only.'),
  regNo: z
    .string({ required_error: 'Registration number is required.' })
    .trim()
    .toUpperCase()
    .regex(REG_NO_RE, 'Enter your VIT registration number, e.g. 24BCE2353.'),
  email: z
    .string({ required_error: 'Email is required.' })
    .trim()
    .toLowerCase()
    .regex(VIT_EMAIL_RE, 'Use your VIT email address (ending in @vitstudent.ac.in).'),
  phone: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v.replace(/[\s-]/g, '').replace(/^\+?91/, '') : null))
    .refine((v) => v === null || PHONE_RE.test(v), 'Enter a 10-digit Indian mobile number, or leave it blank.'),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(8, 'Password must be at least 8 characters.')
    .max(72, 'Password must be 72 characters or fewer.')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
    .regex(/\d/, 'Password must contain at least one number.'),
});

export const loginSchema = z.object({
  identifier: trimmed(1, 120, 'Email or registration number'),
  password: z.string({ required_error: 'Password is required.' }).min(1, 'Password is required.'),
});

const today = () => new Date().toISOString().slice(0, 10);

export const createItemSchema = z
  .object({
    type: z.enum(ITEM_TYPES, { errorMap: () => ({ message: 'Choose whether the item was lost or found.' }) }),
    title: noContactInfo(trimmed(3, 80, 'Title')),
    description: noContactInfo(trimmed(10, 1000, 'Description')),
    category: z.enum(CATEGORIES, { errorMap: () => ({ message: 'Choose one of the listed categories.' }) }),
    venue: z.enum(VENUES, { errorMap: () => ({ message: 'Choose an official VIT campus venue.' }) }),
    venueDetail: noContactInfo(optionalTrimmed(120, 'Spot within the venue')),
    eventDate: z
      .string({ required_error: 'Date is required.' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.')
      .refine((d) => !Number.isNaN(Date.parse(d)), 'Enter a valid date.')
      .refine((d) => d <= today(), 'Date can’t be in the future.')
      .refine((d) => d >= '2020-01-01', 'Date looks too old. Check the year.'),
    verificationQuestion: noContactInfo(trimmed(8, 200, 'Verification question')),
    privateAnswer: optionalTrimmed(200, 'Expected answer'),
  })
  .strict();

export const listItemsSchema = z.object({
  type: z.enum(ITEM_TYPES).default('found'),
  category: z.enum(CATEGORIES).optional(),
  venue: z.enum(VENUES).optional(),
  group: z.string().optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const createClaimSchema = z
  .object({
    answer: noContactInfo(trimmed(2, 300, 'Answer')),
    note: noContactInfo(optionalTrimmed(500, 'Additional details')),
  })
  .strict();

export const rejectSchema = z.object({ reason: optionalTrimmed(200, 'Reason') });

export const messageSchema = z
  .object({ body: noContactInfo(trimmed(1, 1000, 'Message')) })
  .strict();

export const meetupSchema = z
  .object({
    checkpoint: z.enum(CHECKPOINTS, { errorMap: () => ({ message: 'Choose one of the campus checkpoints.' }) }),
    time: z
      .string({ required_error: 'Meetup time is required.' })
      .refine((t) => !Number.isNaN(Date.parse(t)), 'Enter a valid date and time.')
      .refine((t) => Date.parse(t) > Date.now() - 5 * 60 * 1000, 'Meetup time must be in the future.')
      .refine((t) => Date.parse(t) < Date.now() + 30 * 24 * 3600 * 1000, 'Pick a time within the next 30 days.'),
  })
  .strict();

/** Parse `data` with `schema`, throwing a 400 with per-field messages on failure. */
export function parse(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  const fields = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    if (issue.code === 'unrecognized_keys') continue;
    if (!fields[key]) fields[key] = issue.message;
  }
  const first = Object.values(fields)[0];
  throw badRequest(first ? 'Please fix the highlighted fields.' : 'Request contains unexpected fields.', fields);
}
