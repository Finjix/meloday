import eslint from "@eslint/js";
import nextVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...nextVitals,
  ...tseslint.configs.recommended,
  {
    ignores: [".next/**", "node_modules/**", "data/**", "public/media/**"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
);
