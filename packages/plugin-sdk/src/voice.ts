// The voice surface of the SDK, kept out of the main entry point on purpose.
//
// mediasoup ships a compiled C++ worker. Every type below comes from it, and
// re-exporting them from `index.ts` forced an author writing a chat plugin --
// without a single line of voice code -- to install mediasoup for their types to
// resolve. It is an optional peer dependency instead: install it only if you
// import from '@bullshark/plugin-sdk/voice'.
//
// A plugin that does not declare the `voice` capability is not handed `ctx.voice`
// at runtime, so it has no reason to reach for anything in this file.
import type { Producer } from 'mediasoup/types';
import type { TStreamQualityLayer } from '@bullshark/shared/src/types';

export type TCreateStreamOptions = {
  channelId: number;
  title: string;
  key: string;
  avatarUrl?: string;
  bannerUrl?: string;
  producers: {
    audio?: Producer;
    video?: Producer;
  };
  videoLayers?: TStreamQualityLayer[];
};

export type TExternalStreamHandle = {
  streamId: number;
  remove: () => void;
  update: (options: {
    title?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    producers?: {
      audio?: Producer;
      video?: Producer;
    };
    videoLayers?: TStreamQualityLayer[];
  }) => void;
};

// re-export mediasoup types for plugin usage
export type {
  AppData,
  MediaKind,
  PlainTransport,
  PlainTransportOptions,
  Producer,
  ProducerOptions,
  Router,
  RtpCodecCapability,
  RtpEncodingParameters,
  RtpParameters,
  Transport
} from 'mediasoup/types';
