/** @type {import("next").NextConfig} */
export default {
  poweredByHeader: false,
  // Logo uploads go through a server action; allow files up to 3 MB.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};
