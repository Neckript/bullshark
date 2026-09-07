// upper bitrate used for webcam simulcast. Screen share uses the user-selected bitrate instead
const SIMULCAST_WEBCAM_MAX_BITRATE = 900_000; // 900 kbps

// guardrail to keep every simulcast layer above a bitrate that browsers can encode reliably
const SIMULCAST_MIN_MAX_BITRATE = 100_000; // 100 kbps

// low layer targets a quarter-resolution stream and is capped to stay cheap for constrained receivers
const SIMULCAST_LOW_LAYER_MAX_BITRATE = 150_000;
const SIMULCAST_LOW_LAYER_BITRATE_RATIO = 0.35;
const SIMULCAST_LOW_LAYER_MAX_FRAMERATE = 24;
const SIMULCAST_LOW_LAYER_SCALE = 4;

// middle layer targets half-resolution and balances quality against bandwidth
const SIMULCAST_MID_LAYER_MAX_BITRATE = 500_000;
const SIMULCAST_MID_LAYER_BITRATE_RATIO = 0.65;
const SIMULCAST_MID_LAYER_MAX_FRAMERATE = 30;
const SIMULCAST_MID_LAYER_SCALE = 2;

// high layer uses the source resolution and the caller-provided maximum bitrate
const SIMULCAST_HIGH_LAYER_SCALE = 1;

// screen share on a Chromium sender uses a single VP9 SVC encoder instead of
// 3 separate VP8 simulcast encoders - one software encoder pass instead of
// three keeps framerate stable at desktop-capture resolutions. L3T3_KEY gives
// 3 spatial layers (matching the simulcast quality picker's 3 options) each
// with 3 temporal layers, and the _KEY suffix keeps spatial upswitches cheap
// by only requiring a keyframe on the layer being added.
const SCREEN_SVC_SCALABILITY_MODE = 'L3T3_KEY';

export {
  SCREEN_SVC_SCALABILITY_MODE,
  SIMULCAST_HIGH_LAYER_SCALE,
  SIMULCAST_LOW_LAYER_BITRATE_RATIO,
  SIMULCAST_LOW_LAYER_MAX_BITRATE,
  SIMULCAST_LOW_LAYER_MAX_FRAMERATE,
  SIMULCAST_LOW_LAYER_SCALE,
  SIMULCAST_MID_LAYER_BITRATE_RATIO,
  SIMULCAST_MID_LAYER_MAX_BITRATE,
  SIMULCAST_MID_LAYER_MAX_FRAMERATE,
  SIMULCAST_MID_LAYER_SCALE,
  SIMULCAST_MIN_MAX_BITRATE,
  SIMULCAST_WEBCAM_MAX_BITRATE
};
