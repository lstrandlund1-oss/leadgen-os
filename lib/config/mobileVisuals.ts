/**
 * Temporary A/B toggle for the mobile hero/section background treatment.
 *
 * true  = keep the nebula cloud (frozen, static) behind the stars, same
 *         composition as desktop just not moving.
 * false = drop the nebula entirely — plain black background with just
 *         the static star field on top.
 *
 * Flip this, redeploy, check on a phone, then once a direction is picked
 * the losing branch (in app/page.tsx, search for MOBILE_NEBULA_ENABLED)
 * should be deleted rather than left dead behind this flag.
 */
export const MOBILE_NEBULA_ENABLED = true;
