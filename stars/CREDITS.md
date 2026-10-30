# Star catalogue

`catalogue.bin` holds 756,195 real stars with measured distances, built by `tools/build-stars.js` from two sources:

- **Gaia DR3** (European Space Agency): every star brighter than G = 10.5 with a parallax measured to better than 10%
  (`ra, dec, parallax, phot_g_mean_mag, bp_rp` from `gaiadr3.gaia_source`). This work has made use of data from the
  European Space Agency (ESA) mission Gaia (https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and
  Analysis Consortium (DPAC). Funding for the DPAC has been provided by national institutions, in particular the
  institutions participating in the Gaia Multilateral Agreement. Terms: https://www.cosmos.esa.int/web/esdc/terms-and-conditions
- **HYG database** v4.1 by David Nash (astronexus; Hipparcos, Yale Bright Star and Gliese catalogues) for the stars brighter
  than magnitude 4, which saturate Gaia's detectors. Used under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/);
  this packed derivative is shared under the same licence.

Changes: positions converted to galactic coordinates in light-years, absolute magnitude kept (from Gaia G and parallax),
B−V colour kept (approximated from Gaia BP−RP), and the game's own collectable objects removed.
