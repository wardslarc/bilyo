import Link from "next/link";
import type { Metadata } from "next";
import {
  LegalHero,
  LegalBody,
  Contents,
  Lede,
  Clause,
  List,
  LegalTable,
  Row,
  Cell,
  Sub,
  Definition,
} from "@/components/marketing/legal-shell";
import {
  SUPPORT_EMAIL,
  OPERATOR_NAME,
  OPERATOR_ROLE,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_VERSION,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy · Bilyo",
  description:
    "What personal data Bilyo collects, why, who else processes it, and the rights you have under the Data Privacy Act of 2012.",
};

const CONTENTS = [
  { href: "#scope", label: "Scope and responsibility" },
  { href: "#collect", label: "What we collect" },
  { href: "#clients", label: "Your clients' personal data" },
  { href: "#why", label: "Why we process it" },
  { href: "#public-links", label: "Public quotation links" },
  { href: "#email", label: "Email records" },
  { href: "#subprocessors", label: "Who else processes it" },
  { href: "#location", label: "Where data is stored" },
  { href: "#retention", label: "How long we keep it" },
  { href: "#security", label: "Security" },
  { href: "#cookies", label: "Cookies" },
  { href: "#rights", label: "Your rights" },
  { href: "#breach", label: "Breach notification" },
  { href: "#children", label: "Children" },
  { href: "#contact", label: "Changes and contact" },
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

export default function PrivacyPage() {
  return (
    <>
      <LegalHero
        title="Privacy Policy"
        standfirst="What personal data Bilyo collects, why, who else touches it, and what you can ask us to do with it. Written to meet the Data Privacy Act of 2012 (Republic Act No. 10173) and its implementing rules."
        effective={LEGAL_EFFECTIVE_DATE}
        version={LEGAL_VERSION}
        jurisdiction="RA 10173"
      />

      <LegalBody contents={<Contents label="Privacy Policy" items={CONTENTS} />}>
        <Lede>
          Bilyo holds two different kinds of personal data, and answers for them
          differently. That distinction runs through this whole policy, so it
          comes first.
        </Lede>

        <Clause id="scope" n="01" title="Scope and responsibility">
          <LegalTable
            caption="Roles under the Data Privacy Act"
            head={["Data", "Who decides how it is used", "Our role"]}
          >
            <Row>
              <Cell lead>
                Your account and business details
                <Sub>
                  Your name, email, business profile, login records
                </Sub>
              </Cell>
              <Cell>We do</Cell>
              <Cell>Personal Information Controller</Cell>
            </Row>
            <Row>
              <Cell lead>
                Your clients&rsquo; details
                <Sub>
                  Client names, emails, phone numbers, addresses and notes you
                  enter
                </Sub>
              </Cell>
              <Cell>You do</Cell>
              <Cell>
                Personal Information Processor, acting on your instructions
              </Cell>
            </Row>
          </LegalTable>
          <p>
            In plain terms: we answer for what happens to <em>your</em> data. You
            answer for the client records <em>you</em> put into Bilyo, and we only
            act on them to run the service for you.
          </p>
        </Clause>

        <Clause id="collect" n="02" title="What we collect">
          <p>
            Everything below is data you give us or that the service generates as
            you use it. We do not buy personal data, and we do not build
            advertising profiles.
          </p>
          <LegalTable
            caption="Data we hold about you"
            head={["Category", "What it includes", "Why"]}
          >
            <Row>
              <Cell lead>Account</Cell>
              <Cell>
                Name, email address, a bcrypt hash of your password (never the
                password itself), email verification status
              </Cell>
              <Cell>To create and secure your account</Cell>
            </Row>
            <Row>
              <Cell lead>Security</Cell>
              <Cell>
                Two-factor secret (encrypted at rest), recovery code hashes,
                failed-attempt counts and lockout times
              </Cell>
              <Cell>To protect your account, only if you enable 2FA</Cell>
            </Row>
            <Row>
              <Cell lead>Business profile</Cell>
              <Cell>
                Business name, address, email, phone, logo, default currency
              </Cell>
              <Cell>To place your details on quotations and PDFs</Cell>
            </Row>
            <Row>
              <Cell lead>Quotations</Cell>
              <Cell>
                Line items, amounts, dates, quotation numbers, and a frozen
                snapshot of your business and client details as they stood when
                sent
              </Cell>
              <Cell>
                To produce the document and keep sent quotations accurate
              </Cell>
            </Row>
            <Row>
              <Cell lead>Activity</Cell>
              <Cell>
                When a quotation was sent, viewed, accepted or declined, and
                whether the actor was you or the recipient
              </Cell>
              <Cell>To show you a timeline and status</Cell>
            </Row>
            <Row>
              <Cell lead>Email delivery</Cell>
              <Cell>
                Recipient address, subject, and delivery outcome — sent,
                delivered, bounced, complained
              </Cell>
              <Cell>
                To tell you whether your quotation arrived, and to protect
                deliverability
              </Cell>
            </Row>
            <Row>
              <Cell lead>Usage</Cell>
              <Cell>
                Last login, last activity, and server logs including IP address
                and browser user agent
              </Cell>
              <Cell>Security, abuse prevention, and debugging</Cell>
            </Row>
            <Row>
              <Cell lead>Support and payment</Cell>
              <Cell>
                Messages you send us, and the payment reference you supply when
                topping up
              </Cell>
              <Cell>To answer you and to confirm access</Cell>
            </Row>
          </LegalTable>
          <p>
            We do not collect sensitive personal information as the Data Privacy
            Act defines it, and you should not put any into quotation notes.
          </p>
        </Clause>

        <Clause id="clients" n="03" title="Your clients' personal data">
          <p>
            When you save a client, you give us their name and, optionally, their
            email address, phone number, address and your own notes. We store
            that, show it back to you, place it on the quotations you address to
            them, and email it to the address you specify. We do nothing else with
            it. We never contact your clients on our own initiative and never use
            their details to market anything.
          </p>
          <p>
            Because you decide what to collect about your clients and why, you are
            their Personal Information Controller. By entering their details, you
            confirm that you have a lawful basis under RA&nbsp;10173 to hold and
            share them.
          </p>
          <p>
            If one of your clients contacts us directly about their data, we will
            refer them to you and tell you, unless the law requires otherwise.
          </p>
        </Clause>

        <Clause id="why" n="04" title="Why we process it">
          <p>Under section 12 of the Data Privacy Act, our bases are:</p>
          <List>
            <li>
              <strong>Performance of a contract</strong> — running the service you
              signed up for: your account, your quotations, and delivering them.
            </li>
            <li>
              <strong>Legitimate interests</strong> — keeping the service secure,
              preventing abuse and fraud, protecting our email deliverability, and
              debugging faults; balanced against your rights and interests.
            </li>
            <li>
              <strong>Legal obligation</strong> — where a law or a lawful order
              requires us to keep or disclose something.
            </li>
            <li>
              <strong>Consent</strong> — for anything outside the above, such as
              optional product announcements. You can withdraw consent at any
              time.
            </li>
          </List>
        </Clause>

        <Clause id="public-links" n="05" title="Public quotation links">
          <p>
            Every quotation you send gets a link that opens without a login. That
            page shows the quotation, your business details, and your
            client&rsquo;s name and details as recorded on it.
          </p>
          <p>
            The link&rsquo;s code is long and random, and we ask search engines
            not to index these pages, but the page is not password-protected:
            anyone who has the link can open it. Send links only to the people who
            should see them. You can revoke any link from the quotation page,
            which immediately stops it from opening.
          </p>
          <p>
            When someone opens the link, we record the view and, if they respond,
            the acceptance or decline and its timestamp. We do not know who they
            are beyond that.
          </p>
        </Clause>

        <Clause id="email" n="06" title="Email records">
          <p>
            We keep a record of each email the service sends on your behalf:
            recipient, subject, and delivery outcome. We do not keep the message
            body beyond what is needed to produce it.
          </p>
          <p>
            If an address hard-bounces or someone marks a message as spam, we stop
            sending to that address. This protects delivery for every Bilyo user,
            so it is not something we can switch off per account.
          </p>
        </Clause>

        <Clause id="subprocessors" n="07" title="Who else processes it">
          <p>
            We do not sell personal data and we do not share it for anyone
            else&rsquo;s marketing. We use a small number of service providers,
            each bound to process data only on our instructions:
          </p>
          <LegalTable
            caption="Sub-processors"
            head={["Provider", "What it does", "Data it touches"]}
          >
            <Row>
              <Cell lead>Vercel</Cell>
              <Cell>Application hosting and delivery</Cell>
              <Cell>All data in transit; server logs</Cell>
            </Row>
            <Row>
              <Cell lead>MongoDB Atlas</Cell>
              <Cell>Database</Cell>
              <Cell>All stored data</Cell>
            </Row>
            <Row>
              <Cell lead>Vercel Blob</Cell>
              <Cell>File storage</Cell>
              <Cell>Business logos, and our own contribution QR image</Cell>
            </Row>
            <Row>
              <Cell lead>Resend</Cell>
              <Cell>Email delivery</Cell>
              <Cell>
                Recipient addresses, message contents, delivery events
              </Cell>
            </Row>
          </LegalTable>
          <p>
            We will update this list before adding a provider that handles
            personal data. We may also disclose data where a Philippine law, court
            order or lawful government request requires it, or to establish or
            defend a legal claim.
          </p>
        </Clause>

        <Clause id="location" n="08" title="Where data is stored">
          <p>
            Bilyo is built for the Philippines, but the providers above operate
            globally, and your data is stored and processed outside the
            Philippines. Our database is hosted on Amazon Web Services in the Asia
            Pacific (Hong Kong) region,{" "}
            <span className="font-mono text-[0.9em]">ap-east-1</span>. Our hosting
            and email providers process data on their own infrastructure, which
            may be located in other countries including the United States.
          </p>
          <p>
            Under the Data Privacy Act we remain accountable for your data wherever
            it sits, and we contract with each provider on terms that require a
            comparable level of protection.
          </p>
        </Clause>

        <Clause id="retention" n="09" title="How long we keep it">
          <LegalTable caption="Retention" head={["Data", "Kept for"]}>
            <Row>
              <Cell lead>Unverified accounts</Cell>
              <Cell>
                7 days from registration, then deleted automatically with
                everything under them
              </Cell>
            </Row>
            <Row>
              <Cell lead>
                Account, business, client and quotation data
              </Cell>
              <Cell>While your account is open</Cell>
            </Row>
            <Row>
              <Cell lead>After you close your account</Cell>
              <Cell>
                Your public links stop working immediately and the account can no
                longer be used. Remaining records are permanently deleted within
                30 days.
              </Cell>
            </Row>
            <Row>
              <Cell lead>Email delivery records</Cell>
              <Cell>
                12 months. Bounce and complaint suppressions are kept
                indefinitely, so that we never re-send to an address that has
                rejected or reported us.
              </Cell>
            </Row>
            <Row>
              <Cell lead>Server logs</Cell>
              <Cell>
                For as long as our hosting provider retains them, currently no
                more than 30 days
              </Cell>
            </Row>
          </LegalTable>
          <p>
            We may keep specific records longer where a law requires it or to
            defend a legal claim.
          </p>
        </Clause>

        <Clause id="security" n="10" title="Security">
          <p>The measures we take include:</p>
          <List>
            <li>
              Passwords stored only as bcrypt hashes — we cannot read or recover
              your password.
            </li>
            <li>Two-factor secrets encrypted at rest with AES-256-GCM.</li>
            <li>All traffic served over HTTPS.</li>
            <li>
              Quotation links carrying long random codes, never sequential
              identifiers, and revocable at any time.
            </li>
            <li>
              Every query scoped to the signed-in account, so one user&rsquo;s
              data cannot be reached from another&rsquo;s session.
            </li>
            <li>
              Administrative access restricted, protected by two-factor
              authentication, and written to an audit log.
            </li>
          </List>
          <p>
            No system is perfectly secure. Use a strong, unique password and turn
            on two-factor authentication.
          </p>
        </Clause>

        <Clause id="cookies" n="11" title="Cookies">
          <p>
            Bilyo sets only strictly necessary cookies: one to keep you signed in,
            and short-lived ones used during login and email verification. They
            are read only by Bilyo.
          </p>
          <p>
            We do not use advertising cookies, third-party trackers, or cross-site
            analytics. Because we set nothing beyond what the service needs to
            function, there is no consent banner to dismiss.
          </p>
        </Clause>

        <Clause id="rights" n="12" title="Your rights">
          <p>
            Chapter IV of the Data Privacy Act gives you these rights over your
            personal data:
          </p>
          <div className="flex flex-col">
            <Definition term="To be informed">
              To know that we hold your data and how we use it — which is what
              this policy is for.
            </Definition>
            <Definition term="To access">
              To get a copy of what we hold about you.
            </Definition>
            <Definition term="To object">
              To object to processing, including withdrawing any consent you gave.
            </Definition>
            <Definition term="To erasure or blocking">
              To have data removed or suspended where it is outdated, unlawfully
              obtained, or no longer necessary.
            </Definition>
            <Definition term="To rectify">
              To correct anything inaccurate. Most of it you can edit yourself in
              Settings.
            </Definition>
            <Definition term="To data portability">
              To receive your data in a structured, commonly used electronic
              format.
            </Definition>
            <Definition term="To damages">
              To be compensated for harm caused by false, unauthorised or unlawful
              use of your data.
            </Definition>
            <Definition term="To complain">
              To lodge a complaint with the National Privacy Commission.
            </Definition>
          </div>
          <p>
            To exercise any of these, email <Mail />. We will respond within 15
            days and may ask you to confirm your identity first. You can also
            download a copy of your data at any time from Account &rsaquo;
            Settings. If you are not satisfied, you can complain to the National
            Privacy Commission at{" "}
            <a
              href="https://privacy.gov.ph"
              className="text-brass-ink underline decoration-1 underline-offset-2"
              rel="noopener noreferrer"
              target="_blank"
            >
              privacy.gov.ph
            </a>
            .
          </p>
          <p>
            If your request concerns data held by a Bilyo user about you as their
            client, we will pass it to that user, who is its controller.
          </p>
        </Clause>

        <Clause id="breach" n="13" title="Breach notification">
          <p>
            If a security incident affects your personal data in a way that is
            likely to give rise to a real risk of serious harm, we will notify the
            National Privacy Commission and the people affected within 72 hours of
            learning of it, as required by NPC Circular 16-03. The notice will say
            what happened, what data was involved, and what you should do.
          </p>
        </Clause>

        <Clause id="children" n="14" title="Children">
          <p>
            Bilyo is a business tool and is not directed at anyone under 18. We do
            not knowingly collect data from minors. If you believe a minor has
            registered, write to us and we will delete the account.
          </p>
        </Clause>

        <Clause id="contact" n="15" title="Changes and contact">
          <p>
            If we change this policy materially, we will email your registered
            address before the change takes effect and update the date at the top.
          </p>
          <p>
            Our contact person for data protection is {OPERATOR_NAME},{" "}
            {OPERATOR_ROLE}, reachable at <Mail />.
          </p>
          <p>
            See also our{" "}
            <Link
              href="/terms"
              className="text-brass-ink underline decoration-1 underline-offset-2"
            >
              Terms of Service
            </Link>
            .
          </p>
        </Clause>
      </LegalBody>
    </>
  );
}
