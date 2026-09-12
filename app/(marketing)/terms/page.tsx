import Link from "next/link";
import type { Metadata } from "next";
import {
  LegalHero,
  LegalBody,
  Contents,
  Lede,
  Clause,
  Notice,
  List,
} from "@/components/marketing/legal-shell";
import {
  SUPPORT_EMAIL,
  OPERATOR_NAME,
  LEGAL_VENUE,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_VERSION,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service · Bilyo",
  description:
    "The terms you agree to when you use Bilyo to create and send quotations.",
};

const CONTENTS = [
  { href: "#agreement", label: "Who you are agreeing with" },
  { href: "#what-bilyo-is", label: "What Bilyo is — and is not" },
  { href: "#account", label: "Your account" },
  { href: "#beta", label: "Beta service" },
  { href: "#content", label: "Your content" },
  { href: "#public-links", label: "Public quotation links" },
  { href: "#acceptable-use", label: "Acceptable use" },
  { href: "#not-a-party", label: "Quotes are between you and your client" },
  { href: "#access", label: "Bilyo Access and payment" },
  { href: "#donations", label: "Donations" },
  { href: "#termination", label: "Suspension and termination" },
  { href: "#disclaimers", label: "Disclaimers" },
  { href: "#liability", label: "Limitation of liability" },
  { href: "#indemnity", label: "Indemnity" },
  { href: "#changes", label: "Changes to these terms" },
  { href: "#law", label: "Governing law" },
  { href: "#contact", label: "Contact" },
];

function Mail() {
  return (
    <a
      href={`mailto:${SUPPORT_EMAIL}`}
      className="text-brass-ink underline decoration-1 underline-offset-2"
    >
      {SUPPORT_EMAIL}
    </a>
  );
}

export default function TermsPage() {
  return (
    <>
      <LegalHero
        title="Terms of Service"
        standfirst="Please read these before creating an account. By registering for Bilyo, or by using it in any way, you agree to them. If you do not agree, do not use the service."
        effective={LEGAL_EFFECTIVE_DATE}
        version={LEGAL_VERSION}
        jurisdiction="Philippines"
      />

      <LegalBody contents={<Contents label="Terms of Service" items={CONTENTS} />}>
        <Lede>
          Bilyo turns quotations into confirmed sales for Philippine service
          businesses. These terms cover what you can expect from it, and what we
          expect from you.
        </Lede>

        <Clause id="agreement" n="01" title="Who you are agreeing with">
          <p>
            Bilyo (&ldquo;Bilyo&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a
            web application operated by {OPERATOR_NAME}, an individual based in
            the Philippines, reachable at <Mail />. &ldquo;You&rdquo; means the
            person who registers an account, and any business you register that
            account on behalf of.
          </p>
          <p>
            If you use Bilyo for a company, partnership or sole proprietorship,
            you confirm you are authorised to accept these terms for it, and
            &ldquo;you&rdquo; includes that business.
          </p>
        </Clause>

        <Clause id="what-bilyo-is" n="02" title="What Bilyo is — and is not">
          <p>
            Bilyo lets you create quotations, send them to your clients as a
            private link or a PDF, and track whether the client viewed, accepted
            or declined them.
          </p>
          <Notice>
            <p>
              <strong className="text-text">
                This is a quotation, not a tax document.
              </strong>{" "}
              Documents produced by Bilyo are not invoices, official receipts,
              sales invoices, statements of account, or any other document
              recognised by the Bureau of Internal Revenue.
            </p>
            <p>
              Bilyo is not an accounting system, an invoicing system, or a BIR
              compliance tool, and does not compute, withhold, file or remit any
              tax. Meeting your invoicing, receipting, bookkeeping and tax
              obligations remains entirely yours.
            </p>
          </Notice>
          <p>
            We may add, change or remove features at any time. We will not
            deliberately remove a feature you are actively relying on without
            notice, but during beta (section 4) the service is expected to change
            often.
          </p>
        </Clause>

        <Clause id="account" n="03" title="Your account">
          <p>You must be at least 18 years old to register.</p>
          <List>
            <li>Give accurate registration details, and keep them current.</li>
            <li>
              You must verify your email address before your account becomes
              usable. We do this so that quotation links and notifications
              actually reach you, and to keep unreachable addresses out of the
              service.
            </li>
            <li>
              Keep your password confidential. You are responsible for everything
              done through your account. We strongly recommend switching on
              two-factor authentication in Account &rsaquo; Security.
            </li>
            <li>
              Tell us at <Mail /> promptly if you believe your account has been
              accessed by someone else.
            </li>
            <li>
              One person, one account. Do not share logins or transfer your
              account without our written agreement.
            </li>
          </List>
          <p>
            Accounts that are registered but never verified are deleted
            automatically after seven days, along with anything created under
            them.
          </p>
        </Clause>

        <Clause id="beta" n="04" title="Beta service">
          <p>Bilyo is currently in free public beta. That means, plainly:</p>
          <List>
            <li>It is free to use, and no card is required.</li>
            <li>There is no uptime guarantee and no service level agreement.</li>
            <li>
              Features may change, break, or be removed with little or no notice.
            </li>
            <li>
              We will not delete your quotations arbitrarily, but we cannot
              promise that beta data survives every change. Download PDFs of
              anything you need to keep.
            </li>
            <li>
              We may end the beta, or the service, at any time on reasonable
              notice to your registered email.
            </li>
          </List>
        </Clause>

        <Clause id="content" n="05" title="Your content">
          <p>
            Your quotations, client records, business details, logo and everything
            else you put into Bilyo remain yours. We claim no ownership of them.
          </p>
          <p>
            You grant us only the permission we need to run the service for you:
            to store, copy, transmit, render and back up your content, to display
            it to the recipients you send it to, and to render it into PDFs and
            emails. This permission ends when you delete the content or close your
            account.
          </p>
          <p>
            You are responsible for your content being lawful and accurate —
            including the prices, terms and descriptions in every quotation you
            send.
          </p>
        </Clause>

        <Clause id="public-links" n="06" title="Public quotation links">
          <p>
            The core of Bilyo is a link your client can open without an account.
            You should understand exactly what that means:
          </p>
          <List>
            <li>
              <strong>Anyone holding the link can view the quotation.</strong> The
              link contains a long random code and is not listed or indexed
              anywhere, but it is not password-protected. Treat it as you would
              treat an emailed PDF.
            </li>
            <li>
              The page shows the quotation contents, your business details as they
              stood when you sent it, and your client&rsquo;s name and details as
              recorded on the quotation.
            </li>
            <li>
              Anyone with the link can press <strong>Accept</strong> or{" "}
              <strong>Decline</strong>. We record when that happened, but we
              cannot verify who pressed it. An acceptance recorded through the
              link is evidence of a response, not a verified electronic signature.
            </li>
            <li>
              You can revoke a link at any time from the quotation page, which
              immediately stops it from opening.
            </li>
          </List>
          <p>
            You choose who to send links to, and you are responsible for that
            choice.
          </p>
        </Clause>

        <Clause id="acceptable-use" n="07" title="Acceptable use">
          <p>Do not use Bilyo to:</p>
          <List>
            <li>
              send quotations to people who have not agreed to hear from you, or
              otherwise send bulk unsolicited email;
            </li>
            <li>
              impersonate another business, or issue quotations you have no
              authority to issue;
            </li>
            <li>
              produce anything designed to be mistaken for an invoice, official
              receipt or other BIR document;
            </li>
            <li>
              commit fraud, launder money, or facilitate any unlawful transaction;
            </li>
            <li>
              upload malware, or content that infringes someone else&rsquo;s
              rights;
            </li>
            <li>
              probe, scrape, overload, or attempt to gain unauthorised access to
              the service or another user&rsquo;s data;
            </li>
            <li>
              resell or white-label the service without our written agreement.
            </li>
          </List>
          <p>
            Because our ability to deliver every user&rsquo;s quotations depends
            on our email reputation, we treat spam and bounce complaints seriously
            and may suspend an account that generates them.
          </p>
        </Clause>

        <Clause
          id="not-a-party"
          n="08"
          title="Quotations are between you and your client"
        >
          <p>
            Bilyo is a tool for producing and delivering documents. We are not a
            party to any quotation, contract or transaction between you and your
            client, and we do not process, hold or guarantee payment of any amount
            quoted.
          </p>
          <p>
            Whether a quotation forms a binding contract, and on what terms, is a
            matter between you and your client under Philippine law. We make no
            representation that a quotation produced in Bilyo is enforceable,
            complete, or suitable for your particular trade. Add your own terms to
            your quotations where you need them.
          </p>
        </Clause>

        <Clause id="access" n="09" title="Bilyo Access and payment">
          <p>
            Bilyo is free during beta. When paid access begins, we will announce a
            start date in advance by email and on the site.
          </p>
          <p>
            Paid access is expected to work as a prepaid, time-based pass
            (&ldquo;Bilyo Access&rdquo;) of a fixed duration — for example 30, 90
            or 365 days — rather than an automatically renewing subscription.
            Nothing charges you automatically; a pass simply ends when its days
            run out.
          </p>
          <List>
            <li>
              Prices are shown in Philippine pesos, and include or exclude tax as
              stated at the point of purchase.
            </li>
            <li>
              Top-ups are confirmed against a payment reference you provide.
              Access is activated once we have confirmed the payment, which during
              early operation is done manually and takes up to one business day.
            </li>
            <li>
              You may request a full refund within 7 days of activating a pass,
              provided you have not sent a quotation using it. After 7 days, or
              once a quotation has been sent on that pass, it is non-refundable.
              Nothing in this section limits any right you have under the Consumer
              Act of the Philippines or other applicable law, including where the
              service is defective or not delivered.
            </li>
            <li>
              When a pass expires, your data is not deleted. You keep access to
              your account and can view and export existing quotations; creating
              and sending new ones requires an active pass.
            </li>
          </List>
        </Clause>

        <Clause id="donations" n="10" title="Donations">
          <p>
            Bilyo is free to use. If we display a contribution QR code, any
            amount you send through it is a voluntary gift, not payment for the
            service.
          </p>
          <List>
            <li>
              No amount is required, suggested or expected, and the QR has no
              amount attached to it.
            </li>
            <li>
              A contribution grants no additional features, access, priority,
              storage, support or entitlement of any kind. Nothing in your
              account changes whether you send one or not.
            </li>
            <li>
              Contributions are non-refundable, and they are not credited
              against any future Bilyo Access pass.
            </li>
            <li>
              The transfer happens entirely within GCash. We do not receive,
              see or store any record of who sent what.
            </li>
          </List>
          <p>
            We may stop displaying the QR code, or stop accepting contributions,
            at any time and without notice.
          </p>
        </Clause>

        <Clause id="termination" n="11" title="Suspension and termination">
          <p>
            You may stop using Bilyo at any time and delete your account from
            Account &rsaquo; Settings.
          </p>
          <p>
            We may suspend or terminate an account that breaches these terms, that
            we reasonably believe is being used unlawfully, or that is damaging the
            service for other users — for example by generating email complaints.
            Where the circumstances allow it, we will tell you why and give you a
            chance to put it right first.
          </p>
          <p>
            On termination, we stop serving your public quotation links and delete
            your data in line with section 9 of the{" "}
            <Link
              href="/privacy"
              className="text-brass-ink underline decoration-1 underline-offset-2"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </Clause>

        <Clause id="disclaimers" n="12" title="Disclaimers">
          <p>
            Bilyo is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;.
            To the fullest extent Philippine law allows, we disclaim all
            warranties not expressly stated here, including implied warranties of
            merchantability, fitness for a particular purpose, and
            non-infringement.
          </p>
          <p>
            We do not warrant that the service will be uninterrupted or
            error-free, that every email we send on your behalf will reach its
            recipient&rsquo;s inbox, or that the service satisfies any particular
            legal, tax or regulatory requirement that applies to your business.
          </p>
        </Clause>

        <Clause id="liability" n="13" title="Limitation of liability">
          <p>
            To the fullest extent Philippine law allows, we are not liable for
            indirect, incidental, special or consequential loss, or for lost
            profits, lost sales, lost business opportunities, or loss or
            corruption of data, however caused.
          </p>
          <p>
            Our total aggregate liability arising out of or relating to Bilyo is
            limited to the greater of the amount you paid us for the service in
            the twelve months before the claim arose, or PHP&nbsp;3,000. While the
            service is free of charge, that means PHP&nbsp;3,000.
          </p>
          <p>
            Nothing here excludes liability that cannot lawfully be excluded,
            including liability for fraud, wilful misconduct, or gross negligence.
          </p>
        </Clause>

        <Clause id="indemnity" n="14" title="Indemnity">
          <p>
            You agree to indemnify us against claims, losses and reasonable costs
            arising from your content, from your use of Bilyo in breach of these
            terms or of any law, or from a dispute between you and one of your
            clients.
          </p>
        </Clause>

        <Clause id="changes" n="15" title="Changes to these terms">
          <p>
            We may update these terms. If a change materially affects your rights,
            we will email your registered address at least 14 days before it takes
            effect. Continuing to use Bilyo after the effective date means you
            accept the updated terms; if you do not, delete your account before
            that date.
          </p>
        </Clause>

        <Clause id="law" n="16" title="Governing law">
          <p>
            These terms are governed by the laws of the Republic of the
            Philippines. Any dispute will be brought before the proper courts of{" "}
            {LEGAL_VENUE}, to the exclusion of other venues, without preventing
            either of us from seeking urgent injunctive relief elsewhere.
          </p>
        </Clause>

        <Clause id="contact" n="17" title="Contact">
          <p>
            Questions about these terms: <Mail />.
          </p>
        </Clause>
      </LegalBody>
    </>
  );
}
