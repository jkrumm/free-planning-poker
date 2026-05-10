export default function Blocked() {
  return (
    <div>
      <h1>Rate Limit Exceeded</h1>
      <p>You have made too many requests. Please try again later.</p>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/">Return Home</a>
    </div>
  );
}
