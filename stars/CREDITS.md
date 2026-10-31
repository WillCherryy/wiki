# Star and object catalogues

## `catalogue.bin` and `names.txt`

992,615 real stars with measured distances, in two sections (format `SCT3`, described in `tools/build-stars-near.js`):

1. **Beyond 100 pc** (718,806 stars, positions to 0.85 ly), built by `tools/build-stars.js`: every Gaia DR3 star brighter than
   G = 10.5 with a parallax measured to better than 10%, and HYG for the stars brighter than magnitude 4.
2. **Within 100 pc** (273,809 stars, positions to 0.01 ly), built by `tools/build-stars-near.js`: every Gaia DR3 star with
   `parallax > 10 mas` and `parallax_over_error > 10`; fainter than G = 10.5 only when `ruwe < 1.4` (which rejects spurious
   parallaxes among faint stars); bright stars and binaries as before. HYG supplies the stars brighter than magnitude 4.
   Queried through GAVO's `gaia.dr3lite` (Heidelberg), a mirror of the Gaia archive.

- **Gaia DR3** (European Space Agency). This work has made use of data from the European Space Agency (ESA) mission Gaia
  (https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and Analysis Consortium (DPAC). Funding for the DPAC
  has been provided by national institutions, in particular the institutions participating in the Gaia Multilateral Agreement.
  Terms: https://www.cosmos.esa.int/web/esdc/terms-and-conditions
- **HYG database** v4.1 by David Nash (astronexus; Hipparcos, Yale Bright Star and Gliese catalogues), for the brightest stars
  and for star names. Used under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/); this packed derivative is
  shared under the same licence.

Changes: positions converted to galactic coordinates in light-years, absolute magnitude kept (from Gaia G and parallax),
B−V colour kept (approximated from Gaia BP−RP), the game's own collectable objects removed, and stars already listed as
ultracool dwarfs in `points.json` removed (so none is drawn twice).

## `points.json`

24,392 objects that are not ordinary catalogue stars, each at its published position and distance, built by
`tools/build-points.js` (Scorcher Sky only):

| Objects | Source | Licence / terms |
|---|---|---|
| 863 galaxies within ~11 Mpc | Updated Nearby Galaxy Catalog: Karachentsev, Makarov & Kaisina 2013, AJ 145, 101 (via NASA HEASARC) | Public research catalogue |
| 14,409 galaxies, by redshift | IRAS PSCz redshift survey: Saunders et al. 2000, MNRAS 317, 55 (via HEASARC) | Public research catalogue |
| 4,368 pulsars | ATNF Pulsar Catalogue v2.9.0: Manchester et al. 2005, AJ 129, 1993 (https://www.atnf.csiro.au/research/pulsar/psrcat/); model distances from Yao, Manchester & Wang 2017, ApJ 835, 29 | Free to use with citation |
| 752 O stars | Galactic O-Star Catalog: Maíz Apellániz et al. 2004, ApJS 151, 103 (via HEASARC) | Public research catalogue |
| 218 Wolf–Rayet stars | VIIth Catalogue of Galactic Wolf–Rayet Stars: van der Hucht 2001, New Astron. Rev. 45, 135 (via HEASARC) | Public research catalogue |
| 3,731 ultracool dwarfs | UltracoolSheet v2.0: Best, Dupuy, Liu, Sanghi, Siverd & Zhang 2025, doi:10.5281/zenodo.15802304 | CC BY 4.0 |

Objects the map already shows as featured objects are left out. Galaxy names are written in the usual form
(NGC 253 for NGC0253; ESO, MCG and Markarian written out). Distances of PSCz galaxies are comoving distances from the
redshift (flat ΛCDM, Planck 2018 parameters); the redshift itself is the published value.
