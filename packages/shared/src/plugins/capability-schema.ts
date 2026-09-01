import z from 'zod';

// zCapability lives in its own module to keep ./marketplace off ./index.
//
// It was first declared in ./index, which re-exports ./marketplace at the
// bottom. marketplace.ts importing it back from '.' closed a cycle: depending on
// which module the runtime evaluated first, zCapability could still be
// uninitialised when marketplace.ts built its schema, and the whole file threw
// "Cannot access 'zCapability' before initialization". The full test suite hid
// it -- some other import happened to warm ./index first -- and it only surfaced
// when a single test file was run on its own.
//
// Deliberately a string, not z.enum(PluginCapability). The interesting failure
// is a plugin built against a NEWER SDK, declaring a capability an OLDER server
// has never heard of: parsing that with z.enum turns it into an unreadable
// schema error about the manifest as a whole, when what the author needs is the
// name of the unsupported capability. Strictness lives where it can act -- the
// builder at build time, the server at load time.
export const zCapability = z.string().min(1);
