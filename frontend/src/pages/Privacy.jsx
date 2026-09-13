import Layout from "../components/Layout";

const CONTACT_EMAIL = "hello@refcheck.example"; // TODO: replace with your real contact address before launch

export default function Privacy() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-6 py-14">
        <span className="eyebrow">Legal</span>
        <h1 className="mt-4 font-serif text-4xl text-[#241F1A]">Privacy Policy</h1>
        <p className="mt-3 text-[13px] text-[#9C8F7A]">Last updated: 12 September 2026</p>

        <div className="mt-10 space-y-8 text-[14px] text-[#6B5F4F] leading-relaxed">
          <section>
            <h2 className="font-serif text-xl text-[#241F1A] mb-2">What we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your name, email address, and profile picture, from Google when you sign in.</li>
              <li>The photographs and descriptions you submit of a watch you want identified.</li>
              <li>The identification reports generated from that material, and your scan history.</li>
              <li>Basic payment records (amount, status) if you unlock a full report — RefCheck never sees or stores your card details; Stripe handles that directly.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl text-[#241F1A] mb-2">How we use it</h2>
            <p>
              Your photos and description are sent to Anthropic's Claude API to generate the identification report,
              and compared against our internal reference database. Your account and scans are stored so you can
              return to your collection. We do not sell your data or use it for advertising.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-[#241F1A] mb-2">Who we share it with</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Google</strong> — for sign-in only.</li>
              <li><strong>Anthropic</strong> — receives your uploaded photos and description text to run the AI analysis.</li>
              <li><strong>Stripe</strong> — processes payment for report unlocks; we receive only a transaction status, never your card details.</li>
              <li><strong>MongoDB Atlas</strong> — hosts our database (accounts, scans, reports).</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl text-[#241F1A] mb-2">Your choices</h2>
            <p>
              You can sign out at any time. To request a copy of your data or ask us to delete your account and
              associated scans, email <a href={`mailto:${CONTACT_EMAIL}`} className="underline text-[#241F1A]">{CONTACT_EMAIL}</a>.
              We handle deletion requests manually and will confirm once it's done.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-[#241F1A] mb-2">Changes to this policy</h2>
            <p>
              If this policy changes materially, we'll update the date above. Continued use of RefCheck after a
              change means you accept the revised policy.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl text-[#241F1A] mb-2">Contact</h2>
            <p>
              Questions about this policy: <a href={`mailto:${CONTACT_EMAIL}`} className="underline text-[#241F1A]">{CONTACT_EMAIL}</a>.
            </p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
