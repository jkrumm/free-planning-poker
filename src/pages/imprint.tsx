import React from 'react';

import { type NextPage } from 'next';
import Link from 'next/link';

import { Button } from '@mantine/core';

import { RouteType } from 'fpp/server/db/schema';

import { useTrackPageView } from 'fpp/hooks/use-tracking.hook';

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
            <h4>Service Provider</h4>
            Johannes Krumm
            <br />
            Based in Munich, Germany
            <br />
            <br />
            <h4>Contact Information</h4>
            For direct communication,
            <br />
            please visit our contact page <br />
            and fill out the form provided.
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
            We are highly committed to protecting your privacy. We collect
            anonymized website usage analytics to improve our services and
            ensure compliance with the General Data Protection Regulation
            (GDPR). We do not use cookies or store any personally identifiable
            information (PII). Any data collected by us or third-party systems
            is scrubbed, encrypted, and anonymized. Detailed policies are
            provided below.
            <br />
            As an open-source project, we are transparent about our practices
            and welcome any questions or concerns. Please use our contact form
            to reach out. We are happy to provide further information.
            <br />
            <br />
            <h4>Detailed Privacy Policy</h4>
            We collect <strong>anonymized website usage analytics</strong> to
            enhance our services and user experience, ensuring our full
            compliance with the GDPR, without employing cookies or other
            continuous tracking technologies.
            <br />
            The data we accumulate includes{' '}
            <strong>generic device details</strong> (such as type, OS, browser),
            approximate geolocation (incorporating country, city, region), and a
            randomized unique session ID saved in your local storage. We use a
            professional IP address API service (ip-api.com) to procure this
            anonymized geolocation data. You may refer to{' '}
            <a
              href="https://ip-api.com/docs/legal"
              target="_blank"
              rel="noopener noreferrer"
            >
              ip-api.com privacy policy
            </a>
            . This data acquisition service is entirely GDPR compliant, ensuring
            the encryption of data in transit. Neither us nor ip-api.com process
            or store any personally identifiable information or more specially
            your IP address.
            <br />
            The <strong>unique session ID</strong> enables us to monitor your
            page visits and certain activities on our site, such as your
            entering a room and final vote, helping us to understand user
            behaviors and preferences.
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            This data collection operates under the 'legitimate interests'
            lawful basis as per GDPR Article 6(1)(f). As we only deal with
            anonymized data and perform no processing of personally identifiable
            information, there is no need for prior consent. We maintain our
            unwavering commitment to your privacy and strictly adhere to data
            protection principles.
            <br />
            <br />
            Our service employs a custom-built, open-source{' '}
            <strong>WebSocket server</strong> implemented using Bun and ElysiaJS
            to enable real-time communication. This server, part of the
            free-planning-poker.com project, is completely stateless and does
            not track or store any user information. Its sole purpose is to
            share the current state of voting among connected users. You can
            view the code and contribute to its development on our{' '}
            <a
              href="https://github.com/jkrumm/free-planning-poker"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub repository
            </a>
            . It is running on a Hetzner VPS located in Nuremberg, Germany.
            <br />
            <br />
            We utilize <strong>Sentry</strong> for error tracking to improve our
            services.{' '}
            <a
              href="https://sentry.io/trust/privacy/gdpr-best-practices/"
              target="_blank"
              rel="noopener noreferrer"
            >
              We configured Sentry
            </a>{' '}
            to be fully GDPR compliant and ensuring the security and privacy of
            data. You can read more about their privacy practices here:{' '}
            <a
              href="https://sentry.io/trust/privacy/"
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* eslint-disable-next-line react/no-unescaped-entities */}
              Sentry Privacy Policy
            </a>
            . In our implementation, we ensure that no PII is sent to Sentry.
            Our configuration and implementation removes user details (request
            headers, user context and ip address) before sending an error event
            to Sentry to maintain our commitment to GDPR compliance.
            <br />
            <br />
            Personal details offered through our <strong>
              contact form
            </strong>{' '}
            (name and email), in agreement with GDPR definitions, are managed
            with utmost confidentiality and used solely for responding to your
            inquiries. We use resend.com as a third-party service to forward
            these emails securely to our inbox. Resend.com is fully GDPR
            compliant and does not store any personal data or the information
            you entered into the contact form fields. You can read more about
            their privacy practices here:{' '}
            <a
              href="https://resend.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Resend.com Privacy Policy
            </a>
            . We will seek your consent prior to using this data for any
            unrelated purpose.
            <br />
            <br />
            Our website runs on a proprietary <strong>database</strong> system
            hosted on a MariaDB in a Hetzner VPS located in Nuremberg, Germany.
            To preserve data integrity, all transfers are encrypted. But the use
            of the database is confined to storing the anonymized website usage
            analytics and has no connection to specific usernames or individual
            votes. Whatever information collected in no way contributes to
            individual profiles.
            <br />
            <br />
            In our service, <strong>usernames</strong> are entirely fictional.
            They are neither stored nor connected to the website usage
            analytics. While these names and corresponding votes are accessible
            upon entry to the room, they are not identifiable. We insist on the
            avoidance of identifiable information as usernames to ensure GDPR
            compliance.
            <br />
            <br />
            <h2>Data Retention</h2>
            Our Bun WebSocket server is stateless, meaning it does not store any
            session data. All communications are ephemeral, ensuring that no
            user information persists beyond the immediate session. Our
            analytics are fully GDPR compliant and are anonymized in such a
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            way that they cannot be linked back to any individual's identity, IP
            address, email, or username. Therefore, we typically do not aim to
            delete the analytics data since it is already anonymized and poses
            no risk to user privacy.
            <br />
            <br />
            <h2>User Rights Under GDPR</h2>
            You have the right to access, rectify, or delete any data we hold
            about you. Since we do not store any personally identifiable
            information, we or third-party tools do not hold any data in this
            regard. However, we are open to deleting even the anonymized data if
            requested. Please reach out to us using our contact form for such
            requests.
            <br />
            <br />
            <h2 id="license">Project License</h2>
            The project is licensed under the GNU Affero General Public License
            v3.0 (AGPLv3). This license ensures that derivative work will be
            released under the same license terms, promoting open source sharing
            and improvements. Users can use, modify, and distribute this
            software and its source code, provided they adhere to the license
            terms. You can review the full license terms by clicking the link
            below.
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
            The PayPal link offered for contributions is solely an option for
            those who voluntarily choose to financially support the continued
            upkeep and development of this tool. Any funds received are
            acknowledged not as formal, tax-deductible donations, or as a
            commercial transaction involving an exchange of goods or services.
            They are considered as supportive contributions aiding in this{' '}
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            tool's further development. As such, these arrangements are not
            governed by German Civil Code (BGB) or Consumer Rights Directive{' '}
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            (2011/83/EU). The use of the term "donation" herein is a common
            terminology in online platforms, and it is important to note its
            context is not linked with the applicable laws and regulations of
            formal, registered charity donations.
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
          </div>
        </div>
      </main>
    </>
  );
};

export default Imprint;
