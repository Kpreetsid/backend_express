export const EXPERIENCE_PROFILES = ["standard_account", "oem"] as const;

export type ExperienceProfile = typeof EXPERIENCE_PROFILES[number];

export const normalizeExperienceProfile = (value: unknown): ExperienceProfile => {
  return value === "oem" ? "oem" : "standard_account";
};

export const isOemExperienceProfile = (value: unknown): boolean => {
  return normalizeExperienceProfile(value) === "oem";
};
