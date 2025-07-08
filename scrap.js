const cheerio = require("cheerio");
const puppeteer = require("puppeteer");

function convertPullCountToNumber(pullText) {
  if (!pullText) return 0;

  const multiplier = pullText.includes("B")
    ? 1000000000
    : pullText.includes("M")
    ? 1000000
    : pullText.includes("K")
    ? 1000
    : 1;
  const num = parseFloat(pullText.replace(/[^\d.]/g, ""));

  return num * multiplier;
}

function clasificarFiabilidad(imagen) {
  const pulls = imagen.numero_de_descargas || 0;
  const stars = imagen.estrellas || 0;

  if (pulls > 1000000 && stars > 1000) {
    return "Muy fiable ★★★★★";
  } else if (pulls > 500000 && stars > 500) {
    return "Fiable ★★★★";
  } else if (pulls > 100000 && stars > 100) {
    return "Moderadamente fiable ★★★";
  } else if (pulls > 10000) {
    return "Poco fiable ★★";
  } else {
    return "No verificado ★";
  }
}

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const url = "https://hub.docker.com/search?q=mysql&type=image";
  try {
    await page.goto(url, { waitUntil: "networkidle0" });

    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    const $ = cheerio.load(bodyHTML);

    // Get all the image cards
    // const imageCards = $('a[data-testid="product-card"]');
    const imageCards = $("a.css-1wqeyfi");
    const results = [];

    const allStats = $("p.css-gjtbzo")
      .map((i, el) => $(el).text().replaceAll("\n", "").trim())
      .get();

    imageCards.each((index, card) => {
      const title = $(card)
        .find("h4[title]")
        .text()
        .replaceAll("\n", "")
        .trim();
      if (!title) {
        return;
      }
      const stats = allStats.slice(results.length * 3, results.length * 3 + 3);
      const [pulls, stars, lastUpdated] = stats;

      results.push({
        título: title,
        numero_de_descargas: convertPullCountToNumber(pulls),
        estrellas: parseInt(stars),
        última_actualización: lastUpdated,
      });
    });
    console.log(results);

    const resultadosConFiabilidad = results.map((imagen) => ({
      ...imagen,
      fiabilidad: clasificarFiabilidad(imagen),
    }));

    // // Ordenar por fiabilidad (número de descargas + estrellas)
    const resultadosOrdenados = [...resultadosConFiabilidad].sort((a, b) => {
      return (
        b.numero_de_descargas - a.numero_de_descargas ||
        b.estrellas - a.estrellas
      );
    });

    console.log("\nImágenes ordenadas por fiabilidad:");
    console.table(
      resultadosOrdenados.map((imagen) => ({
        Imagen: imagen.título,
        Descargas: imagen.numero_de_descargas,
        Estrellas: imagen.estrellas,
        "Última actualización": imagen.última_actualización,
        Fiabilidad: imagen.fiabilidad,
      }))
    );

    // Guardar en archivo
    const fs = require("fs");
    fs.writeFileSync(
      "docker_images_es.json",
      JSON.stringify(
        {
          fecha: new Date().toLocaleString("es-ES"),
          total_imagenes: resultadosConFiabilidad.length,
          imagenes: resultadosConFiabilidad,
          imagenes_ordenadas_por_fiabilidad: resultadosOrdenados,
        },
        null,
        2
      )
    );
    console.log("Resultados guardados en docker_images_es.json");
  } catch (err) {
    console.error("Error durante el scraping:", err);
  } finally {
    await browser.close();
  }
})();
