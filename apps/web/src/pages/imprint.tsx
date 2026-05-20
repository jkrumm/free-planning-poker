import { type NextPage } from 'next';
import Link from 'next/link';

import { Button } from '@mantine/core';

import { RouteType } from '@fpp/db';

import { useTrackPageView } from 'fpp/hooks/use-tracking.hook';

import Footer from 'fpp/components/layout/footer';
import { Hero } from 'fpp/components/layout/hero';
import Navbar from 'fpp/components/layout/navbar';
import { Meta } from 'fpp/components/meta';

const Imprint: NextPage = () => {
  useTrackPageView(RouteType.IMPRINT);

  return (
    <>
      <Meta title="Imprint & Privacy Policy" />
      <Navbar />
      <Hero />
      <main className="flex flex-col items-center justify-center">
        <div className="container max-w-[1200px] gap-12 px-4 pb-12 pt-8 md:flex">
          <div className="mb-20 md:mb-0 md:min-w-[250px]">
            <h2>Imprint</h2>
            <h4>Operated by</h4>
            Johannes Krumm
            <br />
            Munich, Germany
            <br />
            <br />
            Free Planning Poker is a free, open-source, non-commercial project
            run by a private individual.
            <br />
            <br />
            <h4>Contact</h4>
            For privacy reasons, I do not publish a private postal address or
            email address here. Please use the contact form to reach me — it
            goes straight to my inbox. I read every message and respond to all
            genuine enquiries, including data-protection requests.
            <br />
            <br />
            <Link href="/contact">
              <Button variant="outline" color="gray">
                Contact
              </Button>
            </Link>
          </div>
          <div>
            <h2>Privacy Policy</h2>
            <h4>Summary (TL;DR)</h4>
            Free Planning Poker is built to be private by design.
            <strong>
              {' '}
              No cookies. No third-party advertising or tracking.
            </strong>{' '}
            Your IP address is never sent to any third party and is never
            stored. We run our own analytics and error monitoring on our own
            servers in Germany — no Google Analytics, no external trackers, no
            advertising networks. The little data we keep (coarse location,
            browser type, anonymous usage) is tied only to a random ID generated
            in your browser, never to your name, email, or IP address. Because
            we set no non-essential cookies and load no third-party trackers,
            you see no cookie banner.
            <br />
            <br />
            As an open-source project we are transparent about how this works.
            The full source code is on{' '}
            <a
              href="https://github.com/jkrumm/free-planning-poker"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            , and you are welcome to verify any of the claims below. If anything
            is unclear, please reach out via the contact form.
            <br />
            <br />
            <h4>Controller</h4>
            The controller responsible for data processing on this website is
            Johannes Krumm, Munich, Germany (see the Imprint). The fastest way
            to contact me about privacy is the contact form.
            <br />
            <br />
            <h4>What we collect, and why</h4>
            We process a deliberately small amount of data to understand how the
            tool is used and to keep it working:
            <br />
            <br />
            <strong>Usage analytics.</strong> For each visit we store generic
            device details (device type, operating system, browser), a coarse
            approximate location (country, region, and city), and a random,
            anonymous ID that is generated in your browser and saved in your
            local storage. Using that ID we record page views and certain
            actions (for example entering a room or copying a room link) so we
            can understand overall usage patterns. This ID is random and is not
            linked to your name, email, or IP address.
            <br />
            <br />
            <strong>Approximate location.</strong> The country, region, and city
            are derived from Vercel edge headers at the moment your request
            arrives. Your IP address is resolved to a coarse location at the
            edge and is{' '}
            <strong>
              never forwarded to a third party and never stored by us
            </strong>
            . If the location cannot be determined, we simply store nothing for
            that field — we do not fall back to any external IP lookup service.
            <br />
            <br />
            <strong>Estimations (votes).</strong> When a voting round is
            revealed, the individual estimations are saved linked to the random
            anonymous ID and the room, together with a timestamp, so we can show
            room history and aggregate statistics. These records are tied to the
            anonymous ID only — your chosen username is never stored with them,
            and the data does not identify you.
            <br />
            <br />
            <strong>Contact form.</strong> If you use the contact form, we
            process the email address you provide (and your name, if you choose
            to add one) for the sole purpose of answering your message. This is
            described under Recipients below.
            <br />
            <br />
            <h4>Legal basis</h4>
            Usage analytics and the operation of the service are based on our
            legitimate interests in understanding and improving the tool and
            keeping it secure and reliable (Art. 6(1)(f) GDPR). Because the data
            is minimal and not directly identifying, this poses a low risk to
            your privacy. Processing of contact-form data is based on taking
            steps at your request and answering your enquiry (Art. 6(1)(b) and
            (f) GDPR).
            <br />
            <br />
            <h4>Cookies and storage on your device</h4>
            We do not use cookies. We store a small amount of data in your
            browser local storage: your chosen username and your interface
            preferences (which are strictly necessary to provide the features
            you request), and the random anonymous analytics ID described above.
            We do not use any cross-site, fingerprinting, or advertising
            technologies. Because we set no non-essential cookies and embed no
            third-party trackers, no consent banner is required.
            <br />
            <br />
            <h4>Recipients and processors</h4>
            We keep the number of parties involved to a minimum:
            <br />
            <br />
            <strong>Hosting (frontend / CDN):</strong> the website is served by
            Vercel Inc. (USA). Vercel processes technical request data and
            provides the edge geolocation described above, under a data
            processing agreement and EU Standard Contractual Clauses.
            <br />
            <br />
            <strong>Application servers and database:</strong> our real-time
            WebSocket server, our database (MariaDB), and our telemetry stack
            run on a Hetzner VPS located in Nuremberg, Germany. The WebSocket
            server is stateless and exists only to share the current voting
            state between connected participants; all transfers are encrypted.
            <br />
            <br />
            <strong>Error monitoring and tracing:</strong> we use a self-hosted
            OpenTelemetry stack (ClickStack / HyperDX) on the same German VPS —
            no third-party observability provider is involved. Our
            instrumentation is configured to exclude personal data such as IP
            addresses, request headers, and email addresses from spans and log
            records.
            <br />
            <br />
            <strong>Contact email delivery:</strong> messages from the contact
            form are first received by our own self-hosted email service in
            Germany and then delivered to our inbox through Resend (Resend,
            Inc., USA) acting as a processor under a data processing agreement
            and EU Standard Contractual Clauses. We do not store contact-form
            messages in our application database and we do not use them for
            marketing.{' '}
            <a
              href="https://resend.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Resend privacy policy
            </a>
            .
            <br />
            <br />
            <h4>International transfers</h4>
            Most processing happens in Germany. Where a processor is located in
            the USA (Vercel for hosting, Resend for contact email), the transfer
            is covered by a data processing agreement and EU Standard
            Contractual Clauses. We do not transfer your IP address abroad for
            geolocation.
            <br />
            <br />
            <h4>Data retention</h4>
            The WebSocket server is stateless and keeps no data beyond the live
            session. Anonymous usage analytics and estimation records are kept
            to observe long-term trends; because they are tied only to a random
            ID and contain no directly identifying information, we do not
            routinely delete them. We will delete data on request where feasible
            (see your rights below). Contact-form messages are kept only as long
            as needed to handle your enquiry.
            <br />
            <br />
            <h4>Your rights</h4>
            Under the GDPR you have the right to access your data, to have it
            rectified or erased, to restrict or object to its processing, and to
            data portability, as well as the right to withdraw any consent you
            have given. Because we do not store directly identifying
            information, we may be unable to locate data about a specific person
            without additional information from you; we will nonetheless act on
            genuine requests, including deleting anonymous data tied to your
            local storage ID where you can identify it. To exercise any of these
            rights, please use the contact form.
            <br />
            <br />
            <h4>Right to lodge a complaint</h4>
            You also have the right to lodge a complaint with a data protection
            supervisory authority. The authority responsible for us is the
            Bavarian State Office for Data Protection Supervision (Bayerisches
            Landesamt für Datenschutzaufsicht, BayLDA), Ansbach, Germany —{' '}
            <a
              href="https://www.lda.bayern.de"
              target="_blank"
              rel="noopener noreferrer"
            >
              www.lda.bayern.de
            </a>
            . You may also contact the supervisory authority of your habitual
            residence.
            <br />
            <br />
            <h2 id="license">Project License</h2>
            The project is licensed under the GNU Affero General Public License
            v3.0 (AGPLv3). This license ensures that derivative work is released
            under the same license terms, promoting open-source sharing and
            improvement. You can use, modify, and distribute this software and
            its source code provided you adhere to the license terms.
            <br />
            <br />
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://github.com/jkrumm/free-planning-poker/blob/master/LICENSE"
            >
              <Button variant="outline" color="gray">
                AGPLv3 license
              </Button>
            </a>
            <br />
            <br />
            <h2>Donations</h2>
            The donation link is purely an option for those who voluntarily
            choose to financially support the continued upkeep and development
            of this tool. Any funds received are not formal, tax-deductible
            donations, nor a commercial transaction involving an exchange of
            goods or services. They are supportive contributions toward the
            further development of the tool. As such, these arrangements are not
            governed by the German Civil Code (BGB) or the Consumer Rights
            Directive (2011/83/EU). The use of the term donation here is common
            terminology on online platforms and is not linked to the laws and
            regulations governing formal, registered charity donations.
            <br />
            <br />
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://paypal.me/johanneskrum"
            >
              <Button variant="outline" color="gray">
                Donate
              </Button>
            </a>
            <br />
            <br />
            <small>Last updated: 20 May 2026</small>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default Imprint;
