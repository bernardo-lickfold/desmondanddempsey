Desmond & Dempsey — UGC carousel content
========================================

The homepage community carousel ("From the D&D community", the section after the
collection tabs) pulls ALL its media from THIS folder. Each card is one image OR
one short video.

Files currently here  (all four cards are videos)
-------------------------------------------------
  ugc-1.mp4  +  ugc-1.jpg (poster)  — card 1
  ugc-2.mp4  +  ugc-2.jpg (poster)  — card 2
  ugc-3.mp4  +  ugc-3.jpg (poster)  — card 3
  ugc-4.mp4  +  ugc-4.jpg (poster)  — card 4

  Posters were auto-generated from each clip's first frame; replace them with a
  nicer still if you like. The .mp4s were transcoded to web-sized H.264
  (~320x568) from the originals — the full-res source files are kept out of the
  repo (ask if you need them back).

  Heads-up:
    • ugc-2.mp4 and ugc-4.mp4 are currently the SAME clip — swap one to vary.
    • These clips have no audio track, so the Mute button is silent for now
      (it still works; it'll unmute real sound once a clip with audio is used).

Recommended specs
-----------------
  Images : portrait 3:4 (~340 x 448 shown), web-sized JPG/PNG/WebP, < ~500 KB.
  Videos : portrait 3:4, short & looping, compressed .mp4 (H.264), no audio track
           needed (they start muted). Always ship a poster still so the card looks
           right before it plays. Keep them light — a few MB max.

Where the cards are defined
---------------------------
Card markup lives in TWO files — keep them in sync:
  • v1.2.html                    (working/dev copy)
  • dnd-site/homepage/index.html (deployed copy)

Add / swap an IMAGE card
------------------------
  <article class="ugc-card" data-media="image">
    <a class="ugc-card__link" href="PRODUCT_URL" aria-label="NAME — shop the look">
      <span class="ugc-card__media">
        <img src="assets/ugc/FILE.jpg" alt="Community photo — NAME" />
      </span>
      <span class="ugc-card__tag">@handle</span>
      <span class="ugc-card__info">
        <span class="ugc-card__meta">
          <span class="ugc-card__name">NAME</span><span class="ugc-card__price">£00</span>
        </span>
        <span class="ugc-card__swatches">
          <img class="ugc-card__swatch" src="assets/images/swatches/s1.png" alt="" />
        </span>
      </span>
    </a>
  </article>

Add / swap a VIDEO card (adds the mute button)
----------------------------------------------
  <article class="ugc-card" data-media="video">
    <a class="ugc-card__link" href="PRODUCT_URL" aria-label="NAME — shop the look">
      <span class="ugc-card__media">
        <video class="ugc-card__video" src="assets/ugc/FILE.mp4" poster="assets/ugc/FILE.jpg"
               muted loop playsinline preload="none"></video>
      </span>
      <span class="ugc-card__tag">@handle</span>
      <span class="ugc-card__info"> ...same as the image card... </span>
    </a>
    <button class="ugc-card__mute" type="button" aria-label="Unmute video" aria-pressed="false">Mute</button>
  </article>

How it behaves
--------------
  • The carousel auto-scrolls and PAUSES while you hover the section.
  • Hovering a card reveals its @handle tag and product info.
  • Video cards start playing (muted) on hover; the Mute button toggles sound.
  • You can add as many cards as you like — the scroll speed stays constant
    (set via data-speed, px/sec, on <section class="ugc">). The track is cloned
    automatically for a seamless loop, so add each card only ONCE.
