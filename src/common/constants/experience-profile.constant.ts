export const EXPERIENCE_PROFILES = ["standard_account", "oem"] as const;

export type ExperienceProfile = typeof EXPERIENCE_PROFILES[number];

export const normalizeExperienceProfile = (value: unknown): ExperienceProfile => {
  const str = String(value || "").trim().toLowerCase();
  if (str === "oem" || str === "oem_account" || str === "insights") {
    return "oem";
  }
  return "standard_account";
};

export const isOemExperienceProfile = (value: unknown): boolean => {
  return normalizeExperienceProfile(value) === "oem";
};

export const isStandardExperienceProfile = (value: unknown): boolean => {
  return normalizeExperienceProfile(value) === "standard_account";
};
