export default function Page() {
  return (
    <main style={{padding:20,fontFamily:'ui-sans-serif,system-ui'}}>
      <h1>Anon E2EE Chat</h1>
      <p>Open the client:</p>
      <p><a href="/chat.html">/chat.html</a></p>
      <p>Signaling endpoint will be at <code>/api/ws</code>.</p>
    </main>
  );
}
