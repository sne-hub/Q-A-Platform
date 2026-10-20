import { AskFlow } from "@/components/AskFlow";

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <p className="kicker">Welcome to the SANRAL Ethics Event - 21 October 2026.</p>
        <p className="lede">
          Share your details first. Then ask up to three questions, or stop
          sooner if you are done. You will only see your own questions here.
        </p>
      </section>
      <AskFlow />
    </main>
  );
}
