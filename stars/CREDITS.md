# Star catalogue

`catalogue.bin` holds 109,356 real stars with measured distances, built by `tools/build-stars.js` from the
[HYG database](https://github.com/astronexus/HYG-Database) v4.1 by David Nash (astronexus), which combines the
Hipparcos, Yale Bright Star and Gliese catalogues. It is used under the Creative Commons Attribution-ShareAlike 4.0
licence (https://creativecommons.org/licenses/by-sa/4.0/). This packed derivative is shared under the same licence.

Changes: positions converted to galactic coordinates in light-years, absolute magnitude and B−V colour kept, stars
without a distance or beyond 8,000 light-years and the game's own collectable objects removed.
