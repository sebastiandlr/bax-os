import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_RADIOGRAPHY_INPUTS,
  RADIOGRAPHY_INPUTS_STORAGE_KEY
} from "../_lib/constants";
import { parseSeedUrls } from "../_lib/seedUrls";
import type { RadiographyInputsState } from "../_lib/types";

export type RadiographyInputsController = {
  radiographyInputs: RadiographyInputsState;
  seedUrls: string[];
  handleRadiographyInputChange: (
    key: keyof RadiographyInputsState,
    value: string
  ) => void;
};

export const useRadiographyInputs = (): RadiographyInputsController => {
  const [radiographyInputs, setRadiographyInputs] = useState<RadiographyInputsState>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_RADIOGRAPHY_INPUTS;
    }

    try {
      const stored = window.localStorage.getItem(RADIOGRAPHY_INPUTS_STORAGE_KEY);
      if (!stored) {
        return DEFAULT_RADIOGRAPHY_INPUTS;
      }

      const parsed = JSON.parse(stored) as Partial<{
        business_name: unknown;
        city: unknown;
        country: unknown;
        language: unknown;
        seed_urls: unknown;
        seed_urls_text: unknown;
      }>;
      const seedUrlsFromArray = Array.isArray(parsed.seed_urls)
        ? parsed.seed_urls.filter((url): url is string => typeof url === "string")
        : [];
      const seedText =
        typeof parsed.seed_urls_text === "string"
          ? parsed.seed_urls_text
          : seedUrlsFromArray.join("\n");

      return {
        business_name:
          typeof parsed.business_name === "string"
            ? parsed.business_name
            : DEFAULT_RADIOGRAPHY_INPUTS.business_name,
        city:
          typeof parsed.city === "string"
            ? parsed.city
            : DEFAULT_RADIOGRAPHY_INPUTS.city,
        country:
          typeof parsed.country === "string"
            ? parsed.country
            : DEFAULT_RADIOGRAPHY_INPUTS.country,
        language:
          typeof parsed.language === "string"
            ? parsed.language
            : DEFAULT_RADIOGRAPHY_INPUTS.language,
        seed_urls_text: seedText
      };
    } catch {
      return DEFAULT_RADIOGRAPHY_INPUTS;
    }
  });

  const seedUrls = useMemo(
    () => parseSeedUrls(radiographyInputs.seed_urls_text),
    [radiographyInputs.seed_urls_text]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const payload = {
      business_name: radiographyInputs.business_name,
      city: radiographyInputs.city,
      country: radiographyInputs.country,
      language: radiographyInputs.language,
      seed_urls: seedUrls
    };

    window.localStorage.setItem(
      RADIOGRAPHY_INPUTS_STORAGE_KEY,
      JSON.stringify(payload)
    );
  }, [radiographyInputs, seedUrls]);

  const handleRadiographyInputChange = useCallback(
    (key: keyof RadiographyInputsState, value: string) => {
      setRadiographyInputs((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  return {
    radiographyInputs,
    seedUrls,
    handleRadiographyInputChange
  };
};
