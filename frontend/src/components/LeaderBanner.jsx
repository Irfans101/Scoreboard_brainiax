import { AnimatePresence, motion } from "framer-motion";

export default function LeaderBanner({ leader }) {
  const text = leader === "TIED" ? "MATCH TIED" : `${leader} LEADS`;

  return (
    <div className="leader-shell">
      <AnimatePresence mode="wait">
        <motion.div
          key={text}
          className="leader-banner"
          initial={{ opacity: 0, y: 36, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 1.02 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          {text}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
