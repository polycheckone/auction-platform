/**
 * Parsuje adres z API Ministerstwa Finansów
 * Format typowy: "ul. Przykładowa 123, 00-000 Miasto"
 * lub: "00-000 Miasto, ul. Przykładowa 123"
 */
function parseAddress(address) {
  if (!address) return { street: '', city: '', postalCode: '' };

  const result = { street: '', city: '', postalCode: '' };

  try {
    // Szukaj kodu pocztowego (XX-XXX)
    const postalMatch = address.match(/(\d{2}-\d{3})/);
    if (postalMatch) {
      result.postalCode = postalMatch[1];
    }

    // Podziel po przecinku
    const parts = address.split(',').map(p => p.trim());

    for (const part of parts) {
      // Jeśli część zawiera kod pocztowy, to prawdopodobnie miasto
      if (part.includes(result.postalCode)) {
        // Usuń kod pocztowy i weź resztę jako miasto
        result.city = part.replace(result.postalCode, '').trim();
      } else if (part.match(/^(ul\.|al\.|pl\.|os\.)/i) || part.match(/^\d/) || part.match(/^[A-ZĄĆĘŁŃÓŚŹŻ]/)) {
        // To prawdopodobnie ulica
        if (!result.street) {
          result.street = part;
        }
      }
    }

    // Jeśli miasto nie zostało znalezione, spróbuj inaczej
    if (!result.city && parts.length > 0) {
      // Szukaj części z kodem pocztowym
      for (const part of parts) {
        if (part.includes(result.postalCode)) {
          result.city = part.replace(/\d{2}-\d{3}/, '').trim();
          break;
        }
      }
    }

    // Jeśli nadal nie ma miasta, weź ostatnią część
    if (!result.city && parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      result.city = lastPart.replace(/\d{2}-\d{3}/, '').trim();
    }
  } catch (error) {
    console.error('Address parsing error:', error);
  }

  return result;
}

module.exports = { parseAddress };
