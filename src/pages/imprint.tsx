import React from 'react';

import { type NextPage } from 'next';
import Link from 'next/link';

import { Button } from '@mantine/core';

import { RouteType } from 'fpp/server/db/schema';

import { useTrackPageView } from 'fpp/hooks/use-tracking.hook';

import { Hero } from 'fpp/components/layout/hero';
import { Meta } from 'fpp/components/meta';

const Imprint: NextPage = () => {
  useTrackPageView(RouteType.IMPRINT);

  return (
    <>
      <Meta title="Imprint & Privacy Policy" />
      <Hero />
      <main className="flex flex-col items-center justify-center">
        <div className="container max-w-[1200px] gap-12 px-4 pb-28 pt-8 md:flex">
          <div className="mb-20 md:mb-0 md:min-w-[250px]">
            <h1>Imprint</h1>
            <h3>Service Provider</h3>
            Johannes Krumm
            <br />
            Based in Munich, Germany
            <br />
            <br />
            <h3>Contact Information</h3>
            For direct communication,
            <br />
            please visit our contact page <br />
            and fill out the form provided.
            <br />
            <br />
            <Link href="/contact">
              <Button>Contact</Button>
            </Link>
          </div>
          <div>
            <h1>Privacy Policy</h1>
            <h2>Summary (TL;DR)</h2>
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
            <h2>Detailed Privacy Policy</h2>
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
            Our service heavily relies on Ably, a <strong>
              WebSocket
            </strong>{' '}
            provider known for making data protection compliance its priority
            and adhering to EU GDPR while employing 256-bit AES encryption. Ably
            ensures that data in transit remains secure and confidential. You
            may refer to{' '}
            <a
              href="https://ably.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ablys privacy policy
            </a>
            . Within our service, Ably Websockets enable the transparent sharing
            of usernames and votes. However, this data does not persist after
            exiting the room or once the room remains inactive for a period.
            Therefore, data from previous sessions, including usernames and
            votes, cannot be accessed by later visitors unless actively present
            in the room.
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
              Sentry's Privacy Policy
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
            inquiries. We will seek your consent prior to using this data for
            any unrelated purpose. Moreover, we do not use any third-party
            services for our contact form, which could access or store your
            data.
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
            We ensure that all Ably channels are automatically closed and
            deleted after 5 minutes of inactivity or when the last user leaves.
            Our analytics are fully GDPR compliant and are anonymized in such a
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
            <h1 id="license">Project License</h1>
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
              <Button>AGPLv3 license</Button>
            </a>
            <br />
            <br />
            <h1>Donations</h1>
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
              <Button>Donate</Button>
            </a>
          </div>
        </div>
      </main>
    </>
  );
};

export default Imprint;
