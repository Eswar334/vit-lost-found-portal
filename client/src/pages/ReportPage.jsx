import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { Button, ErrorState, Field, FormError, PageLoader } from '../components/ui.jsx';
import { useMeta } from '../context/MetaContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const CONTACT_RE = /(?:\+?91[\s-]?)?(?:\d[\s-]?){10}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

const QUESTION_IDEAS = {
  'ID Cards': 'What name and branch are printed on the ID card?',
  'Room Keys': 'What is written on the key tag, or what does the keychain look like?',
  Calculators: 'What model is it, and is there any sticker or marking on it?',
  'Lab Equipment': 'What is written or engraved on it?',
  Earphones: 'What brand and colour are they, and is there any damage or mark?',
  Wallets: 'What cards are inside and roughly how much cash?',
};

const empty = (type) => ({
  type,
  title: '',
  category: '',
  venue: '',
  venueDetail: '',
  eventDate: today(),
  description: '',
  verificationQuestion: '',
  privateAnswer: '',
});

function validate(f) {
  const e = {};
  if (f.title.trim().length < 3) e.title = 'Give the item a short title (at least 3 characters).';
  if (!f.category) e.category = 'Choose a category.';
  if (!f.venue) e.venue = 'Choose where on campus.';
  if (!f.eventDate) e.eventDate = 'Pick a date.';
  else if (f.eventDate > today()) e.eventDate = 'Date can’t be in the future.';
  if (f.description.trim().length < 10) e.description = 'Describe the item in at least 10 characters.';
  if (f.verificationQuestion.trim().length < 8) e.verificationQuestion = 'Write a question only the real owner could answer.';
  for (const k of ['title', 'description', 'venueDetail', 'verificationQuestion']) {
    if (!e[k] && CONTACT_RE.test(f[k])) e[k] = 'Remove phone numbers and email addresses. They’re blocked for your safety.';
  }
  return e;
}

export default function ReportPage() {
  const { meta, error: metaError, retry } = useMeta();
  const toast = useToast();
  const [params] = useSearchParams();
  const [form, setForm] = useState(() => empty(params.get('type') === 'lost' ? 'lost' : 'found'));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  if (metaError) return <ErrorState error={metaError} onRetry={retry} />;
  if (!meta) return <PageLoader />;

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) {
      setFormError('Please fix the highlighted fields.');
      document.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    setBusy(true);
    try {
      const d = await api('/items', {
        method: 'POST',
        body: { ...form, venueDetail: form.venueDetail || null, privateAnswer: form.privateAnswer || null },
      });
      setCreated(d.item);
      toast('Report posted.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErrors(err.fields || {});
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return (
      <div className="narrow">
        <div className="panel panel-success" role="status">
          <h1>Your report is on the board</h1>
          <p>
            {created.type === 'found'
              ? 'When someone claims it, you’ll review their answer privately on your dashboard. Your contact details stay hidden.'
              : 'If someone finds it, they’ll answer your question and you can approve them from your dashboard.'}
          </p>
          <div className="row">
            <Link className="btn btn-primary" to={`/items/${created.id}`}>
              View the post
            </Link>
            <Button
              variant="secondary"
              onClick={() => {
                setCreated(null);
                setForm(empty(form.type));
              }}
            >
              Report another item
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isFound = form.type === 'found';

  return (
    <div className="narrow">
      <h1>Report an item</h1>
      <p className="lede">Other students will see your post under a pseudonym. Your name, registration number, email and phone stay hidden.</p>

      <form className="form-card" onSubmit={submit} noValidate>
        <fieldset className="type-switch">
          <legend>What happened?</legend>
          <label className={`type-opt type-found ${isFound ? 'on' : ''}`}>
            <input type="radio" name="type" value="found" checked={isFound} onChange={set('type')} />
            <span className="type-name">I found something</span>
            <span className="type-desc">Help the owner get it back</span>
          </label>
          <label className={`type-opt type-lost ${!isFound ? 'on' : ''}`}>
            <input type="radio" name="type" value="lost" checked={!isFound} onChange={set('type')} />
            <span className="type-name">I lost something</span>
            <span className="type-desc">Ask the campus to keep an eye out</span>
          </label>
        </fieldset>

        <FormError error={formError} />

        <Field label="Title" hint="A short name, like “Casio fx-991ES calculator”." error={errors.title}>
          {(p) => <input {...p} value={form.title} maxLength={80} onChange={set('title')} />}
        </Field>

        <div className="grid-2">
          <Field label="Category" error={errors.category}>
            {(p) => (
              <select {...p} value={form.category} onChange={set('category')}>
                <option value="">Choose…</option>
                {meta.categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label={isFound ? 'Date found' : 'Date lost'} error={errors.eventDate}>
            {(p) => <input {...p} type="date" max={today()} value={form.eventDate} onChange={set('eventDate')} />}
          </Field>
        </div>

        <div className="grid-2">
          <Field label="Campus venue" error={errors.venue}>
            {(p) => (
              <select {...p} value={form.venue} onChange={set('venue')}>
                <option value="">Choose…</option>
                {meta.venueGroups.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.venues.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </Field>
          <Field label="Spot within the venue" optional hint="Floor, room or landmark." error={errors.venueDetail}>
            {(p) => <input {...p} value={form.venueDetail} maxLength={120} onChange={set('venueDetail')} />}
          </Field>
        </div>

        <Field
          label="Description"
          hint={
            isFound
              ? 'Describe it in general terms. Keep the identifying details for your verification question.'
              : 'Colour, brand, anything that helps someone recognise it.'
          }
          error={errors.description}
        >
          {(p) => <textarea {...p} rows={4} value={form.description} maxLength={1000} onChange={set('description')} />}
        </Field>

        <div className="challenge-box">
          <Field
            label="Verification question"
            hint={
              isFound
                ? 'Anyone claiming the item must answer this. Ask about something only the owner would know.'
                : 'Anyone who says they found it must answer this, so you know they really have it.'
            }
            error={errors.verificationQuestion}
          >
            {(p) => (
              <input
                {...p}
                value={form.verificationQuestion}
                maxLength={200}
                placeholder={QUESTION_IDEAS[form.category] || 'e.g. What name/branch is on the ID tag?'}
                onChange={set('verificationQuestion')}
              />
            )}
          </Field>
          {form.category && !form.verificationQuestion && (
            <button
              type="button"
              className="link-btn"
              onClick={() => setForm((f) => ({ ...f, verificationQuestion: QUESTION_IDEAS[f.category] }))}
            >
              Use the suggested question
            </button>
          )}
          <Field
            label="Expected answer"
            optional
            hint="Only you will see this. It’s shown next to each answer when you review responses."
            error={errors.privateAnswer}
          >
            {(p) => <input {...p} value={form.privateAnswer} maxLength={200} onChange={set('privateAnswer')} />}
          </Field>
        </div>

        <Button type="submit" loading={busy}>
          Post report
        </Button>
      </form>
    </div>
  );
}
