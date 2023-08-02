import { type NextPage } from "next";
import Head from "next/head";
import React, { useEffect } from "react";
import { Hero } from "fpp/components/hero";
import Link from "next/link";
import { Button } from "@mantine/core";
import { api } from "fpp/utils/api";
import {
  getLocalstorageVisitorId,
  setLocalstorageVisitorId,
} from "fpp/store/local-storage";

const Imprint: NextPage = () => {
  const getVisitorId = api.tracking.trackPageView.useMutation();
  useEffect(() => {
    const localstorageVisitorId = getLocalstorageVisitorId();
    getVisitorId.mutate(
      { visitorId: localstorageVisitorId, route: "IMPRINT" },
      {
        onSuccess: (visitorId) => {
          if (!localstorageVisitorId) {
            setLocalstorageVisitorId(visitorId);
          }
        },
      }
    );
  }, []);

  return (
    <>
      <Head>
        <title>Planning Poker - Imprint & Privacy Policy</title>
        <meta
          name="description"
          content="Estimate your story points faster and easier with this free agile scrum sprint planning poker app. Open source and privacy focused."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <meta property="og:title" content="Free Planning Poker" />
        <meta
          property="og:description"
          content="Estimate your story points faster and easier with this free agile scrum sprint planning poker app. Open source and privacy focused."
        />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:url" content="https://free-planning-poker.com/" />
        <meta
          property="og:image"
          content="https://free-planning-poker.com/free-planning-poker.jpg"
        />
        <meta
          property="og:image:secure_url"
          content="https://free-planning-poker.com/free-planning-poker.jpg"
        />
        <meta property="og:image:type" content="image/jpg" />
        <meta property="og:image:width" content="1034" />
        <meta property="og:image:height" content="612" />
        <meta property="og:image:alt" content="Free Planning Poker" />
        <meta charSet="utf-8" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#1971c2" />
        <meta name="msapplication-TileColor" content="#1a1b1e" />
        <meta name="theme-color" content="#1a1b1e" />
      </Head>
      <Hero />
      <main className="flex flex-col items-center justify-center">
        <div className="container flex gap-12 px-4 pb-28 pt-8">
          <div className="md:min-w-[250px]">
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
            improve our services and user experience, in compliance with the
            General Data Protection Regulation (GDPR). Without the use of
            cookies or other permanent tracking technologies. This includes
            generic device information (type, OS, browser), approximate
            geolocation (country, city, region), and the random unique session
            ID stored in your local storage. This ID allows us to track your
            page visits and certain actions on our site, such as entering a room
            and final vote, to help us understand user behavior and preferences.
            <br />
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            Such data collection takes place under the 'legitimate interests'
            lawful basis as per GDPR Article 6(1)(f) as it is crucial for
            analytical purposes and does not involve processing personally
            identifiable information, thus requiring no prior consent. The
            utmost respect for your privacy and adherence to data protection
            principles are steadfastly maintained.
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
            prior to utilizing this data for any other purpose.
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
            They are considered as supportive contributions aiding in this
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            tool's further development. As such, these arrangements are not
            governed by German Civil Code (BGB) or Consumer Rights Directive
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
