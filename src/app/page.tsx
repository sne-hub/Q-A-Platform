import { AskFlow } from "@/components/AskFlow";

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <h1 className="kicker">Ethics Event.</h1>
        <p className="lede">
          Share your details first. Then ask up to three questions, or stop
          sooner if you are done. You will only see your own questions here.
        </p>
      </section>
      <AskFlow />
    </main>
  );
}
