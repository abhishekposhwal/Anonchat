export default function Page() {
  return (
    <main style={{ padding: 24 }}>
      <h1>AnonChat</h1>
      <p>
        Open the client at <a href="/chat.html">/chat.html</a>
      </p>
      <p>
        The signaling endpoint will be available at <code>/api/ws</code>. Use:
      </p>
      <pre>wss://&lt;your-vercel-domain&gt;/api/ws</pre>
    </main>
  );
}
