//! angelito: `@font-face` rules of inline `<style>` sheets, registered under their
//! `font-family` descriptor. Upstream fetched fonts only from linked/imported sheets
//! (`net.rs`) and registered them under the font's internal family name only.

use std::sync::{Arc, Mutex};

use blitz_traits::net::{Bytes, NetHandler, Request, SharedCallback, SharedProvider};
use style::font_face::Source;
use style::shared_lock::SharedRwLockReadGuard;
use style::stylesheets::{CssRule, Stylesheet, StylesheetInDocument};

use crate::net::Resource;

/// Decoded font bytes and the `font-family` they were declared with, waiting for the
/// document to register them (the handler cannot reach the document's font context).
pub(crate) type PendingFonts = Arc<Mutex<Vec<(Bytes, Option<String>)>>>;

/// Fetch every `url()`/`data:` source of the sheet's top-level `@font-face` rules.
/// Reads go through the net provider, which enforces the base-dir sandbox.
pub(crate) fn fetch_font_faces(
    doc_id: usize,
    sheet: &Stylesheet,
    provider: &SharedProvider<Resource>,
    guard: &SharedRwLockReadGuard,
    pending: &PendingFonts,
) {
    for rule in sheet.rules(guard).iter() {
        let CssRule::FontFace(rule) = rule else { continue };
        let rule = rule.read_with(guard);
        let Some(sources) = rule.sources.as_ref() else { continue };
        let family = rule.family.as_ref().map(|f| f.name.to_string());
        for source in &sources.0 {
            let Source::Url(src) = source else { continue };
            let Some(url) = src.url.url() else { continue };
            let handler = FontFaceHandler { family: family.clone(), pending: pending.clone() };
            provider.fetch(doc_id, Request::get(url.as_ref().clone()), Box::new(handler));
        }
    }
}

struct FontFaceHandler {
    family: Option<String>,
    pending: PendingFonts,
}

impl NetHandler<Resource> for FontFaceHandler {
    fn bytes(self: Box<Self>, doc_id: usize, bytes: Bytes, callback: SharedCallback<Resource>) {
        if let Some(font) = decode(bytes) {
            self.pending.lock().unwrap().push((font, self.family));
        }
        // `Resource::None` makes the document drain `pending` even with an async provider.
        callback.call(doc_id, Ok(Resource::None))
    }
}

/// TrueType/OpenType bytes, WOFF/WOFF2 decompressed; `None` for anything else.
/// The format is sniffed from the magic number, not trusted from the URL or `format()`.
fn decode(bytes: Bytes) -> Option<Bytes> {
    match bytes.get(..4)? {
        b"OTTO" | b"true" | [0, 1, 0, 0] => Some(bytes),
        #[cfg(feature = "woff-rust")]
        b"wOFF" => wuff::decompress_woff1(&bytes).ok().map(Bytes::from),
        #[cfg(feature = "woff-rust")]
        b"wOF2" => wuff::decompress_woff2(&bytes).ok().map(Bytes::from),
        #[cfg(all(feature = "woff-c", not(feature = "woff-rust")))]
        b"wOFF" => woff::version1::decompress(&bytes).map(Bytes::from),
        #[cfg(all(feature = "woff-c", not(feature = "woff-rust")))]
        b"wOF2" => woff::version2::decompress(&bytes).map(Bytes::from),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decode_accepts_sfnt_and_rejects_unknown_bytes() {
        let ttf = Bytes::from_static(&[0, 1, 0, 0, 9, 9]);
        assert_eq!(decode(ttf.clone()), Some(ttf));
        assert_eq!(decode(Bytes::from_static(b"OTTOx")).as_deref(), Some(&b"OTTOx"[..]));
        assert_eq!(decode(Bytes::from_static(b"<svg>")), None);
        assert_eq!(decode(Bytes::from_static(b"ab")), None);
        // Truncated WOFF2 must fail cleanly, not panic.
        assert_eq!(decode(Bytes::from_static(b"wOF2\0\0\0\0")), None);
    }
}
