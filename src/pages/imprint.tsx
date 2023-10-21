import { type NextPage } from "next";
import React from "react";
import { Hero } from "fpp/components/layout/hero";
import Link from "next/link";
import { Button } from "@mantine/core";
import { useTrackPageView } from "fpp/hooks/use-tracking.hook";
import { RouteType } from "fpp/server/db/schema";
import { Meta } from "fpp/components/meta";
import { useLogger } from "next-axiom";

const Imprint: NextPage = () => {
  const logger = useLogger().with({ route: RouteType.IMPRINT });
  useTrackPageView(RouteType.IMPRINT, logger);

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
            We collect <strong>anonymized website usage analytics</strong> to
            improve our services and user experience, in full compliance with
            the General Data Protection Regulation (GDPR), without the use of
            cookies or other permanent tracking technologies.
            <br />
            The data we collect includes generic device information (such as
            type, OS, browser), approximate geolocation (incorporating country,
            city, region), and a random unique session ID stored in your local
            storage. We use a professional IP address api service (ipapi.co) to
            acquire this anonymized geolocation data. You may refer to{" "}
            <a
              href="https://ipapi.co/privacy/"
              target="_blank"
              rel="noopener noreferrer"
            >
              their privacy policy
            </a>
            . This data acquisition service is fully GDPR compliant and ensures
            encryption of data in transit. Neither us nor ipapi.co process or
            store any personally identifiable information or more specially your
            IP address.
            <br />
            The unique session id allows us to track your page visits and
            certain actions on our site, such as entering a room and final vote,
            to help us understand user behavior and preferences.
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            Such data collection operates under the 'legitimate interests'
            lawful basis as per GDPR Article 6(1)(f). Since we solely deal with
            anonymized data and perform no processing of personally identifiable
            information, there is no requirement for prior consent. We maintain
            our steadfast commitment to your privacy and adhere strictly to data
            protection principles.
            <br />
            <br />
            Ably, a WebSocket provider, plays a significant role in our
            services. Data protection compliance is prioritized by Ably, with
            adherence to EU GDPR and employing 256-bit AES encryption. Ably
            ensures that data in transit remains secure and confidential.
            <br />
            Within our service, <strong>Ably Websockets</strong> enables the
            transparent sharing of usernames and votes. However, this data does
            not persist after exiting the room or once the room remains inactive
            for a period. Consequently, data from previous sessions, including
            usernames and votes, cannot be accessed by later visitors unless you
            are actively present in the room.
            <br />
            <br />
            Personal details volunteered through our{" "}
            <strong>contact form</strong> (name and email), falling in line with
            GDPR definitions, are handled with utmost confidentiality, and used
            specifically for responding to your inquiries. Consent is sought
            prior to utilizing this data for any other purpose. Furthermore, we
            are not using any third-party services for our contact form where
            your data could be stored.
            <br />
            <br />
            Our website is supported by a database managed by Planetscale,
            operating in convergence with an eu-central-1 hosted AWS MySQL
            database. To assure data integrity, all transfers are encrypted.
            However, the{" "}
            <strong>
              database usage is limited to storing the anonymized website usage
              analytics
            </strong>{" "}
            and bears no link to specific usernames or individual votes.
            Information collected in no way contributes to individual profiles.
            <br />
            <br />
            <strong>Usernames</strong> within our service are purely fictitious.
            They are not stored or linked to the website usage analytics.
            Although accessible upon room entry, these names and corresponding
            votes are not identifiable. We urge avoidance of identifiable
            information as usernames to ensure GDPR compliance.
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
            They are considered as supportive contributions aiding in this{" "}
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            tool's further development. As such, these arrangements are not
            governed by German Civil Code (BGB) or Consumer Rights Directive{" "}
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
