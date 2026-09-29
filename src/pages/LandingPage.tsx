import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { takeSignInReturnPath } from "@/api/client";
import { useCurrentUser } from "@/api/queries";
import brainBenchPress from "@/assets/brain-bench-press.png";
import brainFoamRoll from "@/assets/brain-foam-roll.png";
import brainJumprope from "@/assets/brain-jumprope.png";
import brainOverheadSquat from "@/assets/brain-overhead-squat.png";
import brainShakerBreak from "@/assets/brain-shaker-break.png";
import brainTreadmill from "@/assets/brain-treadmill.png";
import coffeeCurl from "@/assets/coffee-curl.png";
import coffeeJog from "@/assets/coffee-jog.png";
import coffeePlank from "@/assets/coffee-plank.png";
import coffeePushup from "@/assets/coffee-pushup.png";
import coffeeSpotsBrain from "@/assets/coffee-spots-brain.png";
import { Prompt } from "@/components/ui";

const route = getRouteApi("/");

/**
 * One screen, no scrolling: the pitch, and the cast cycling beside it. Picking muscles and
 * starting a workout happen in the workout bar above, on every page.
 */
export function LandingPage() {
  const { signInError } = route.useSearch();
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();

  // Back from signing in, to where the athlete was (e.g. the rack, mid-set).
  useEffect(() => {
    if (!user) return;
    const returnPath = takeSignInReturnPath();
    if (returnPath) navigate({ to: returnPath });
  }, [user, navigate]);

  return (
    <div className="flex flex-1 flex-col justify-center">
      {signInError && (
        <p
          role="alert"
          className="mb-10 border-2 border-danger bg-danger/10 px-4 py-3 text-xs font-semibold text-danger"
        >
          {signInError === "not_invited"
            ? "! The gym is invite-only for now: ask the head coach for an invite, then sign in again."
            : signInError === "account_not_active"
              ? "! This account is blocked. If you think that's a mistake, write to us (Contact, below)."
              : "! Sign-in didn't go through. Give it another rep."}
        </p>
      )}

      <section className="grid items-center gap-10 md:grid-cols-[1fr_auto] lg:gap-16">
        <div>
          <Prompt>./train --brain --reps=inf</Prompt>
          <h1 className="mt-8 font-display text-2xl leading-relaxed md:text-[2rem] md:leading-relaxed lg:text-[2.75rem] lg:leading-relaxed short:mt-5 short:lg:text-[2rem]">
            PICK A <span className="text-pixel">MUSCLE</span>.
            <br />
            TAKE A <span className="bg-blue-tint px-2 text-blue">REP</span>.
          </h1>
          <p className="mt-8 max-w-xl text-sm font-medium leading-relaxed text-ink/70 lg:text-base lg:leading-relaxed short:mt-5 short:lg:text-sm">
            Like every other muscle, the brain can use a workout. Pick the muscles you want to focus
            on and track your progress as you go. Start light, add load as you get stronger, and let
            your weak spots tell you what to train next. We bring the exercises; the reps are yours.
          </p>
        </div>

        <CastCycle />
      </section>
    </div>
  );
}

/**
 * The cast: the brain and the coffee mug, alternating, ending with the two together. 96 × 96
 * pixel-art sprites (in src/assets), each with a light rim so it reads on both themes.
 */
const cast = [
  { src: coffeePushup, alt: "The coffee mug doing push-ups on a mat" },
  { src: brainJumprope, alt: "The brain jumping rope with a USB cable" },
  { src: coffeeCurl, alt: "The coffee mug curling a sugar-cube dumbbell" },
  { src: brainBenchPress, alt: "The brain bench pressing two stacks of books" },
  { src: coffeeJog, alt: "The coffee mug jogging, steam trailing behind" },
  { src: brainOverheadSquat, alt: "The brain squatting with a barbell overhead" },
  { src: coffeePlank, alt: "The coffee mug holding a plank, steam drooping" },
  { src: brainFoamRoll, alt: "The brain foam rolling on a rolled-up keyboard" },
  { src: brainTreadmill, alt: "The brain jogging on a treadmill with a belt of books" },
  { src: brainShakerBreak, alt: "The brain resting on a bench with a protein shaker" },
  { src: coffeeSpotsBrain, alt: "The coffee mug spotting the brain on the bench press" },
];

/** How long each picture stays, in milliseconds. */
const CYCLE_MS = 4000;

/**
 * The cast cross-fading on the page itself, with no frame. The sprites are 96 pixels square and
 * are shown at exactly 3× (288px) or 4× (384px), so every pixel stays square and crisp. With
 * reduced motion, the first picture stays.
 */
function CastCycle() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setCurrent((index) => (index + 1) % cast.length), CYCLE_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <figure className="relative hidden size-72 justify-self-center md:block lg:size-96 short:lg:size-72">
      {cast.map((picture, index) => (
        <img
          key={picture.src}
          src={picture.src}
          alt={index === current ? picture.alt : ""}
          aria-hidden={index !== current}
          className={`absolute inset-0 size-full select-none transition-opacity duration-700 ${
            index === current ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
    </figure>
  );
}
