const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, 'auction.db'));

// Dane z pliku surowce_podpowiadam.xlsx
const categories = [
  { id: 'cat-001', name: 'Stal i metale', icon: '🔩', description: 'Profile, blachy, rury stalowe i nierdzewne' },
  { id: 'cat-002', name: 'Aluminium', icon: '🪟', description: 'Profile i blachy aluminiowe, systemy modulowe' },
  { id: 'cat-003', name: 'Tworzywa sztuczne', icon: '🧪', description: 'PE, PA, PC, POM, gumy i uszczelki' },
  { id: 'cat-004', name: 'Komponenty elektryczne', icon: '⚡', description: 'Silniki, sterowniki PLC, czujniki, kable' },
  { id: 'cat-005', name: 'Elementy złączne', icon: '🔧', description: 'Śruby, łożyska, łańcuchy, pasy' },
  { id: 'cat-006', name: 'Koła i rolki', icon: '⚙️', description: 'Koła transportowe, rolki, taśmy' },
  { id: 'cat-007', name: 'Bezpieczeństwo', icon: '🛡️', description: 'Kurtyny świetlne, wyłączniki, ogrodzenia' },
  { id: 'cat-008', name: 'Inne materiały', icon: '📦', description: 'Farby, smary, kleje, pneumatyka' },
  { id: 'cat-009', name: 'Surowce chemiczne', icon: '🧫', description: 'Kwasy, zasady, rozpuszczalniki, odczynniki' }
];

const materials = [
  // STAL I METALE
  { id: 'mat-001', category_id: 'cat-001', name: 'Profile stalowe (HEB, HEA, IPE, UPN)', description: 'Konstrukcje nośne, ramy przenośników', unit: 'mb' },
  { id: 'mat-002', category_id: 'cat-001', name: 'Blachy stalowe (DC01, S235, S355)', description: 'Obudowy, osłony maszyn, podstawy', unit: 'm²' },
  { id: 'mat-003', category_id: 'cat-001', name: 'Rury stalowe (kwadratowe, okrągłe)', description: 'Konstrukcje, osłony, transportery', unit: 'mb' },
  { id: 'mat-004', category_id: 'cat-001', name: 'Stal nierdzewna (304, 316)', description: 'Przemysł spożywczy, farmaceutyczny', unit: 'kg' },

  // ALUMINIUM
  { id: 'mat-005', category_id: 'cat-002', name: 'Profile aluminiowe (konstrukcyjne)', description: 'Lekkie konstrukcje, osłony, prowadnice', unit: 'mb' },
  { id: 'mat-006', category_id: 'cat-002', name: 'Blachy aluminiowe', description: 'Obudowy, panele, elementy lekkie', unit: 'm²' },
  { id: 'mat-007', category_id: 'cat-002', name: 'Profile systemowe (Bosch Rexroth, Item)', description: 'Stanowiska pracy, ogrodzenia, konstrukcje modułowe', unit: 'mb' },

  // TWORZYWA SZTUCZNE
  { id: 'mat-008', category_id: 'cat-003', name: 'Polietylen PE-HD, PE-UHMW', description: 'Prowadnice, ślizgi, osłony', unit: 'kg' },
  { id: 'mat-009', category_id: 'cat-003', name: 'Poliamid PA6, PA66', description: 'Koła zębate, tuleje, rolki', unit: 'kg' },
  { id: 'mat-010', category_id: 'cat-003', name: 'Poliwęglan PC, Pleksi', description: 'Osłony przezroczyste, zabezpieczenia', unit: 'm²' },
  { id: 'mat-011', category_id: 'cat-003', name: 'POM (Delrin, Acetal)', description: 'Elementy precyzyjne, ślizgi, zębatki', unit: 'kg' },
  { id: 'mat-012', category_id: 'cat-003', name: 'Profile gumowe, uszczelki EPDM', description: 'Uszczelnienia, amortyzacja, osłony', unit: 'mb' },

  // KOMPONENTY ELEKTRYCZNE
  { id: 'mat-013', category_id: 'cat-004', name: 'Silniki elektryczne (AC, DC, serwo)', description: 'Napędy przenośników, manipulatory', unit: 'szt.' },
  { id: 'mat-014', category_id: 'cat-004', name: 'Przekładnie, motoreduktory', description: 'Redukcja obrotów, zwiększenie momentu', unit: 'szt.' },
  { id: 'mat-015', category_id: 'cat-004', name: 'Sterowniki PLC', description: 'Automatyka, sterowanie procesami', unit: 'szt.' },
  { id: 'mat-016', category_id: 'cat-004', name: 'Panele HMI', description: 'Wizualizacja, interfejs operatora', unit: 'szt.' },
  { id: 'mat-017', category_id: 'cat-004', name: 'Czujniki (indukcyjne, optyczne, ultradźw.)', description: 'Detekcja, pomiary, bezpieczeństwo', unit: 'szt.' },
  { id: 'mat-018', category_id: 'cat-004', name: 'Kable i przewody (sterownicze, siłowe)', description: 'Instalacje elektryczne', unit: 'mb' },
  { id: 'mat-019', category_id: 'cat-004', name: 'Falowniki, soft-starty', description: 'Regulacja prędkości, rozruch łagodny', unit: 'szt.' },

  // ELEMENTY ZŁĄCZNE
  { id: 'mat-020', category_id: 'cat-005', name: 'Śruby, nakrętki, podkładki (kl. 8.8, 10.9)', description: 'Połączenia śrubowe konstrukcji', unit: 'szt.' },
  { id: 'mat-021', category_id: 'cat-005', name: 'Łożyska kulkowe i wałkowe', description: 'Łożyskowanie rolek, kół, wrzecion', unit: 'szt.' },
  { id: 'mat-022', category_id: 'cat-005', name: 'Łożyska liniowe, prowadnice', description: 'Ruchy liniowe, manipulatory', unit: 'szt.' },
  { id: 'mat-023', category_id: 'cat-005', name: 'Łańcuchy techniczne (rolkowe, płytk.)', description: 'Przenośniki łańcuchowe', unit: 'mb' },
  { id: 'mat-024', category_id: 'cat-005', name: 'Pasy zębate, klinowe', description: 'Napędy pasowe, synchronizacja', unit: 'szt.' },

  // KOŁA I ROLKI
  { id: 'mat-025', category_id: 'cat-006', name: 'Koła poliuretanowe, transportowe', description: 'Wózki, przenośniki, AGV', unit: 'szt.' },
  { id: 'mat-026', category_id: 'cat-006', name: 'Rolki transportowe (stalowe, plastikowe)', description: 'Przenośniki rolkowe, grawitacyjne', unit: 'szt.' },
  { id: 'mat-027', category_id: 'cat-006', name: 'Rolki napędowe, bębny', description: 'Przenośniki taśmowe, stoły obrotowe', unit: 'szt.' },
  { id: 'mat-028', category_id: 'cat-006', name: 'Taśmy transportowe (PVC, PU, modułowe)', description: 'Przenośniki taśmowe', unit: 'mb' },

  // BEZPIECZEŃSTWO
  { id: 'mat-029', category_id: 'cat-007', name: 'Kurtyny świetlne, czujniki bezp.', description: 'Ochrona stref niebezpiecznych', unit: 'szt.' },
  { id: 'mat-030', category_id: 'cat-007', name: 'Wyłączniki bezpieczeństwa, rygle', description: 'Zabezpieczenie drzwi, klap', unit: 'szt.' },
  { id: 'mat-031', category_id: 'cat-007', name: 'Przekaźniki bezpieczeństwa', description: 'Obwody bezpieczeństwa', unit: 'szt.' },
  { id: 'mat-032', category_id: 'cat-007', name: 'Ogrodzenia ochronne, panele siatkowe', description: 'Wygrodzenie stref niebezpiecznych', unit: 'm²' },

  // INNE MATERIAŁY
  { id: 'mat-033', category_id: 'cat-008', name: 'Farby przemysłowe, proszkowe', description: 'Malowanie konstrukcji', unit: 'l' },
  { id: 'mat-034', category_id: 'cat-008', name: 'Smary, oleje przemysłowe', description: 'Smarowanie łożysk, łańcuchów', unit: 'l' },
  { id: 'mat-035', category_id: 'cat-008', name: 'Kleje przemysłowe, uszczelniacze', description: 'Łączenie, uszczelnianie', unit: 'szt.' },
  { id: 'mat-036', category_id: 'cat-008', name: 'Elementy pneumatyczne (siłowniki, zawory)', description: 'Automatyka pneumatyczna', unit: 'szt.' },

  // SUROWCE CHEMICZNE
  { id: 'mat-037', category_id: 'cat-009', name: 'Kwasy (solny, siarkowy, azotowy, fosforowy)', description: 'Procesy chemiczne, trawienie, czyszczenie', unit: 'kg' },
  { id: 'mat-038', category_id: 'cat-009', name: 'Zasady (wodorotlenek sodu, potasu)', description: 'Neutralizacja, czyszczenie przemysłowe', unit: 'kg' },
  { id: 'mat-039', category_id: 'cat-009', name: 'Rozpuszczalniki (aceton, toluen, ksylen)', description: 'Czyszczenie, rozcieńczanie farb i lakierów', unit: 'kg' },
  { id: 'mat-040', category_id: 'cat-009', name: 'Alkohole techniczne (etanol, IPA, metanol)', description: 'Czyszczenie, dezynfekcja, procesy produkcyjne', unit: 'kg' },
  { id: 'mat-041', category_id: 'cat-009', name: 'Odczynniki laboratoryjne', description: 'Analizy chemiczne, kontrola jakości', unit: 'kg' },
  { id: 'mat-042', category_id: 'cat-009', name: 'Soda kaustyczna, kalcynowana', description: 'Przemysł szklarski, papierniczy, chemiczny', unit: 'kg' },
  { id: 'mat-043', category_id: 'cat-009', name: 'Nadtlenek wodoru (woda utleniona)', description: 'Dezynfekcja, bielenie, procesy utleniania', unit: 'kg' },
  { id: 'mat-044', category_id: 'cat-009', name: 'Glikole (etylenowy, propylenowy)', description: 'Chłodziwa, płyny niezamarzające', unit: 'kg' }
];

const suppliers = [
  // STAL - lokalni Szczecin
  { id: 'sup-001', company_name: 'HurtoStal2', city: 'Szczecin', region: 'zachodniopomorskie', website: 'hst2.pl', is_local: 1, categories: ['cat-001'] },
  { id: 'sup-002', company_name: 'Felmax', city: 'Szczecin', region: 'zachodniopomorskie', address: 'ul. Merkatora 7a', website: 'felmax.com.pl', is_local: 1, categories: ['cat-001'] },
  { id: 'sup-003', company_name: 'BOWIM S.A.', city: 'Szczecin', region: 'zachodniopomorskie', address: 'ul. Pomorska 61-65', website: 'bowim.pl', is_local: 1, categories: ['cat-001'] },
  { id: 'sup-004', company_name: 'Lidmann', city: 'Szczecin', region: 'zachodniopomorskie', address: 'ul. Koksowa 5', website: 'lidmann.pl', is_local: 1, categories: ['cat-001'] },
  { id: 'sup-005', company_name: 'ULAMEX', city: 'Szczecin', region: 'zachodniopomorskie', website: 'ulamex.com.pl', is_local: 1, categories: ['cat-001', 'cat-002'] },
  { id: 'sup-006', company_name: 'CHROMET', city: 'Szczecin', region: 'zachodniopomorskie', website: 'chromet.com.pl', is_local: 1, categories: ['cat-001'] },
  { id: 'sup-007', company_name: 'AskoTech Sp. z o.o.', city: 'Szczecin', region: 'zachodniopomorskie', website: 'askotech.com.pl', is_local: 1, categories: ['cat-001'] },

  // STAL - ogólnopolscy
  { id: 'sup-008', company_name: 'ArcelorMittal Poland', city: 'Dąbrowa Górnicza', region: 'śląskie', website: 'arcelormittal.com', is_local: 0, categories: ['cat-001'] },
  { id: 'sup-009', company_name: 'Konsorcjum Stali', city: 'Zawiercie', region: 'śląskie', website: 'konsorcjumstali.com.pl', is_local: 0, categories: ['cat-001'] },
  { id: 'sup-010', company_name: 'Stalprofil', city: 'Dąbrowa Górnicza', region: 'śląskie', website: 'stalprofil.com.pl', is_local: 0, categories: ['cat-001'] },
  { id: 'sup-011', company_name: 'ThyssenKrupp Materials', city: 'Toruń', region: 'kujawsko-pomorskie', website: 'thyssenkrupp-materials.pl', is_local: 0, categories: ['cat-001'] },
  { id: 'sup-012', company_name: 'RollSteel', city: 'Poznań', region: 'wielkopolskie', website: 'rollsteel.pl', is_local: 0, categories: ['cat-001'] },
  { id: 'sup-013', company_name: 'Italinox', city: 'Wysogotowo', region: 'wielkopolskie', website: 'italinox.pl', is_local: 0, categories: ['cat-001'] },

  // ALUMINIUM - lokalni
  { id: 'sup-014', company_name: 'AL-DOR', city: 'Mierzyn k. Szczecina', region: 'zachodniopomorskie', address: 'ul. Lubieszyńska 40', website: 'al-dor.pl', is_local: 1, categories: ['cat-002'] },
  { id: 'sup-015', company_name: 'Inter-ax', city: 'Mierzyn', region: 'zachodniopomorskie', website: 'inter-ax.pl', is_local: 1, categories: ['cat-002'] },
  { id: 'sup-016', company_name: 'SG TRADE', city: 'Szczecin', region: 'zachodniopomorskie', website: 'sgtrade.tech', is_local: 1, categories: ['cat-002', 'cat-003', 'cat-005', 'cat-007'] },

  // ALUMINIUM - ogólnopolscy
  { id: 'sup-017', company_name: 'Hydro Poland', city: 'Kęty', region: 'małopolskie', website: 'hydro.com', is_local: 0, categories: ['cat-002'] },
  { id: 'sup-018', company_name: 'Aluprof', city: 'Bielsko-Biała', region: 'śląskie', website: 'aluprof.eu', is_local: 0, categories: ['cat-002'] },
  { id: 'sup-019', company_name: 'Bosch Rexroth Polska', city: 'Warszawa', region: 'mazowieckie', website: 'boschrexroth.com', is_local: 0, categories: ['cat-002', 'cat-005'] },
  { id: 'sup-020', company_name: 'Item Polska', city: 'Wrocław', region: 'dolnośląskie', website: 'item24.pl', is_local: 0, categories: ['cat-002'] },

  // TWORZYWA SZTUCZNE - lokalni
  { id: 'sup-021', company_name: 'Plastics Group', city: 'Szczecin', region: 'zachodniopomorskie', address: 'ul. Piskorskiego 21', website: 'plastics.pl', is_local: 1, categories: ['cat-003'] },
  { id: 'sup-022', company_name: 'Gumalit-Haas', city: 'Szczecin', region: 'zachodniopomorskie', website: 'gumalit.com', is_local: 1, categories: ['cat-003', 'cat-006'] },

  // TWORZYWA SZTUCZNE - ogólnopolscy
  { id: 'sup-023', company_name: 'Ensinger Polska', city: 'Leszno', region: 'wielkopolskie', website: 'ensinger.pl', is_local: 0, categories: ['cat-003'] },
  { id: 'sup-024', company_name: 'Röchling', city: 'Gliwice', region: 'śląskie', website: 'roechling.com', is_local: 0, categories: ['cat-003'] },
  { id: 'sup-025', company_name: 'Audioplex', city: 'Łódź', region: 'łódzkie', website: 'audioplex.pl', is_local: 0, categories: ['cat-003'] },

  // KOMPONENTY ELEKTRYCZNE - lokalni
  { id: 'sup-026', company_name: 'Nemra', city: 'Szczecin', region: 'zachodniopomorskie', website: 'nemra.pl', is_local: 1, categories: ['cat-004', 'cat-005', 'cat-006'] },
  { id: 'sup-027', company_name: 'Automatyk Szczecin', city: 'Szczecin', region: 'zachodniopomorskie', website: 'automatyk.szczecin.pl', is_local: 1, categories: ['cat-004', 'cat-007'] },
  { id: 'sup-028', company_name: 'plcontroll', city: 'Szczecin', region: 'zachodniopomorskie', website: 'plcontroll.com', is_local: 1, categories: ['cat-004'] },
  { id: 'sup-029', company_name: 'DOK-MEL', city: 'Szczecin', region: 'zachodniopomorskie', address: 'ul. Gryfińska 104', website: 'dokmel.pl', is_local: 1, categories: ['cat-004'] },
  { id: 'sup-030', company_name: 'FAR', city: 'Szczecin', region: 'zachodniopomorskie', website: 'far.pl', is_local: 1, categories: ['cat-004'] },
  { id: 'sup-031', company_name: 'ELDA', city: 'Szczecin', region: 'zachodniopomorskie', address: 'ul. Cukrowa 18', website: 'elda.szczecin.pl', is_local: 1, categories: ['cat-004'] },

  // KOMPONENTY ELEKTRYCZNE - ogólnopolscy
  { id: 'sup-032', company_name: 'SEW-Eurodrive Polska', city: 'Łódź', region: 'łódzkie', website: 'sew-eurodrive.pl', is_local: 0, categories: ['cat-004'] },
  { id: 'sup-033', company_name: 'Siemens Polska', city: 'Warszawa', region: 'mazowieckie', website: 'siemens.pl', is_local: 0, categories: ['cat-004'] },
  { id: 'sup-034', company_name: 'Lenze', city: 'Katowice', region: 'śląskie', website: 'lenze.com', is_local: 0, categories: ['cat-004'] },
  { id: 'sup-035', company_name: 'Sick Polska', city: 'Warszawa', region: 'mazowieckie', website: 'sick.com', is_local: 0, categories: ['cat-004', 'cat-007'] },
  { id: 'sup-036', company_name: 'IFM Electronic', city: 'Katowice', region: 'śląskie', website: 'ifm.com', is_local: 0, categories: ['cat-004'] },
  { id: 'sup-037', company_name: 'Lapp Kabel', city: 'Biskupice Podgórne', region: 'dolnośląskie', website: 'lappkabel.pl', is_local: 0, categories: ['cat-004'] },
  { id: 'sup-038', company_name: 'Danfoss Polska', city: 'Grodzisk Mazowiecki', region: 'mazowieckie', website: 'danfoss.pl', is_local: 0, categories: ['cat-004'] },

  // ELEMENTY ZŁĄCZNE - lokalni
  { id: 'sup-039', company_name: 'ŚRUBEX', city: 'Szczecin', region: 'zachodniopomorskie', website: 'srubex.pl', is_local: 1, categories: ['cat-005'] },
  { id: 'sup-040', company_name: 'WERBUS', city: 'Szczecin', region: 'zachodniopomorskie', website: 'werbus.pl', is_local: 1, categories: ['cat-005'] },
  { id: 'sup-041', company_name: 'ALAMET', city: 'Szczecin', region: 'zachodniopomorskie', website: 'alamet-zamocowania.pl', is_local: 1, categories: ['cat-005'] },
  { id: 'sup-042', company_name: 'Unimet s.c.', city: 'Szczecin', region: 'zachodniopomorskie', address: 'ul. Kalenicka 15', website: '', is_local: 1, categories: ['cat-005'] },
  { id: 'sup-043', company_name: 'TLC Łożyska', city: 'Szczecin', region: 'zachodniopomorskie', website: 'tlc.pl', is_local: 1, categories: ['cat-005'] },
  { id: 'sup-044', company_name: 'QUAY', city: 'Szczecin', region: 'zachodniopomorskie', website: 'quay.pl', is_local: 1, categories: ['cat-005'] },

  // ELEMENTY ZŁĄCZNE - ogólnopolscy
  { id: 'sup-045', company_name: 'Würth Polska', city: 'Warszawa', region: 'mazowieckie', website: 'wurth.pl', is_local: 0, categories: ['cat-005'] },
  { id: 'sup-046', company_name: 'SKF Polska', city: 'Poznań', region: 'wielkopolskie', website: 'skf.com', is_local: 0, categories: ['cat-005'] },
  { id: 'sup-047', company_name: 'Schaeffler (FAG/INA)', city: 'Warszawa', region: 'mazowieckie', website: 'schaeffler.pl', is_local: 0, categories: ['cat-005'] },
  { id: 'sup-048', company_name: 'Tsubaki-Hoover Polska', city: 'Kraśnik', region: 'lubelskie', website: 'tsubaki.eu', is_local: 0, categories: ['cat-005'] },
  { id: 'sup-049', company_name: 'Optibelt Polska', city: 'Dąbrowa Górnicza', region: 'śląskie', website: 'optibelt.com', is_local: 0, categories: ['cat-005'] },
  { id: 'sup-050', company_name: 'Hiwin GmbH', city: 'Warszawa', region: 'mazowieckie', website: 'hiwin.pl', is_local: 0, categories: ['cat-005'] },

  // KOŁA I ROLKI - lokalni
  { id: 'sup-051', company_name: 'Castors.pl', city: 'Szczecin', region: 'zachodniopomorskie', website: 'castors.pl', is_local: 1, categories: ['cat-006'] },
  { id: 'sup-052', company_name: 'NOVA Szczecin', city: 'Szczecin', region: 'zachodniopomorskie', website: '', is_local: 1, categories: ['cat-006'] },

  // KOŁA I ROLKI - ogólnopolscy
  { id: 'sup-053', company_name: 'Blickle Polska', city: 'Poznań', region: 'wielkopolskie', website: 'blickle.pl', is_local: 0, categories: ['cat-006'] },
  { id: 'sup-054', company_name: 'Interroll', city: 'Warszawa', region: 'mazowieckie', website: 'interroll.com', is_local: 0, categories: ['cat-006'] },
  { id: 'sup-055', company_name: 'MComponents', city: 'Poznań', region: 'wielkopolskie', website: 'mcomponents.pl', is_local: 0, categories: ['cat-006'] },
  { id: 'sup-056', company_name: 'Habasit Polska', city: 'Czeladź', region: 'śląskie', website: 'habasit.com', is_local: 0, categories: ['cat-006'] },
  { id: 'sup-057', company_name: 'Forbo Siegling Poland', city: 'Łódź', region: 'łódzkie', website: 'forbo.com', is_local: 0, categories: ['cat-006'] },

  // BEZPIECZEŃSTWO - lokalni (SG TRADE już dodany)

  // BEZPIECZEŃSTWO - ogólnopolscy
  { id: 'sup-058', company_name: 'Pilz Polska', city: 'Warszawa', region: 'mazowieckie', website: 'pilz.com', is_local: 0, categories: ['cat-007'] },
  { id: 'sup-059', company_name: 'Euchner Polska', city: 'Katowice', region: 'śląskie', website: 'euchner.pl', is_local: 0, categories: ['cat-007'] },
  { id: 'sup-060', company_name: 'Schmersal Poland', city: 'Warszawa', region: 'mazowieckie', website: 'schmersal.pl', is_local: 0, categories: ['cat-007'] },
  { id: 'sup-061', company_name: 'Troax Safety Systems Poland', city: 'Środa Wielkopolska', region: 'wielkopolskie', website: 'troax.com', is_local: 0, categories: ['cat-007'] },
  { id: 'sup-062', company_name: 'Axelent (Haberkorn)', city: 'Kraków', region: 'małopolskie', website: 'haberkorn.pl', is_local: 0, categories: ['cat-007'] },

  // OGRODZENIA - lokalni
  { id: 'sup-063', company_name: 'TCS Ogrodzenia', city: 'Szczecin', region: 'zachodniopomorskie', website: 'tcsogrodzenia.com', is_local: 1, categories: ['cat-007'] },
  { id: 'sup-064', company_name: 'Arkadia Centrum Ogrodzeń', city: 'Szczecin', region: 'zachodniopomorskie', website: 'centrumogrodzen.pl', is_local: 1, categories: ['cat-007'] },

  // INNE MATERIAŁY - lokalni
  { id: 'sup-065', company_name: 'PROMALAK', city: 'Szczecin', region: 'zachodniopomorskie', website: 'promalak-szczecin.pl', is_local: 1, categories: ['cat-008'] },
  { id: 'sup-066', company_name: 'JOTA', city: 'Szczecin', region: 'zachodniopomorskie', website: 'jota.net.pl', is_local: 1, categories: ['cat-008'] },
  { id: 'sup-067', company_name: 'PROAUTO', city: 'Szczecin', region: 'zachodniopomorskie', website: 'proauto.pl', is_local: 1, categories: ['cat-008'] },
  { id: 'sup-068', company_name: 'KACBUD', city: 'Goleniów/Szczecin', region: 'zachodniopomorskie', website: 'kacbud.pl', is_local: 1, categories: ['cat-008'] },
  { id: 'sup-069', company_name: 'Systemy Pneumatyczne', city: 'Szczecin', region: 'zachodniopomorskie', address: 'ul. Belgradzka 22', website: 'systemypneumatyczne.pl', is_local: 1, categories: ['cat-008'] },

  // INNE MATERIAŁY - ogólnopolscy
  { id: 'sup-070', company_name: 'PPG Industries Poland', city: 'Gliwice', region: 'śląskie', website: 'ppg.com', is_local: 0, categories: ['cat-008'] },
  { id: 'sup-071', company_name: 'AkzoNobel', city: 'Warszawa', region: 'mazowieckie', website: 'akzonobel.com', is_local: 0, categories: ['cat-008'] },
  { id: 'sup-072', company_name: 'Shell Polska', city: 'Warszawa', region: 'mazowieckie', website: 'shell.pl', is_local: 0, categories: ['cat-008'] },
  { id: 'sup-073', company_name: 'Klüber Lubrication Polska', city: 'Kobylnica', region: 'wielkopolskie', website: 'klueber.com', is_local: 0, categories: ['cat-008'] },
  { id: 'sup-074', company_name: 'Loctite/Henkel', city: 'Warszawa', region: 'mazowieckie', website: 'henkel.pl', is_local: 0, categories: ['cat-008'] },
  { id: 'sup-075', company_name: 'Festo Polska', city: 'Janki k. Warszawy', region: 'mazowieckie', website: 'festo.pl', is_local: 0, categories: ['cat-008'] },
  { id: 'sup-076', company_name: 'SMC Industrial Automation Polska', city: 'Błonie', region: 'mazowieckie', website: 'smc.eu', is_local: 0, categories: ['cat-008'] },

  // SUROWCE CHEMICZNE - lokalni Szczecin
  { id: 'sup-077', company_name: 'Brenntag Polska - Oddział Szczecin', city: 'Szczecin', region: 'zachodniopomorskie', address: 'ul. Goleniowska 59', website: 'brenntag.com', is_local: 1, categories: ['cat-009'] },

  // SUROWCE CHEMICZNE - ogólnopolscy
  { id: 'sup-078', company_name: 'Brenntag Polska (Centrala)', city: 'Kędzierzyn-Koźle', region: 'opolskie', address: 'ul. Józefa Bema 21', website: 'brenntag.com', is_local: 0, categories: ['cat-009'] },
  { id: 'sup-079', company_name: 'Donauchem Polska', city: 'Rokietnica', region: 'wielkopolskie', address: 'ul. Topolowa 15', website: 'donauchem.pl', is_local: 0, categories: ['cat-009'] },
  { id: 'sup-080', company_name: 'CIECH S.A. (Qemetica)', city: 'Warszawa', region: 'mazowieckie', address: 'ul. Wspólna 62', website: 'qemetica.com', is_local: 0, categories: ['cat-009'] },
  { id: 'sup-081', company_name: 'Stanlab Sp. z o.o.', city: 'Lublin', region: 'lubelskie', address: 'ul. Olszewskiego 13', website: 'stanlab.eu', is_local: 0, categories: ['cat-009'] },
  { id: 'sup-082', company_name: 'PCC Rokita S.A.', city: 'Brzeg Dolny', region: 'dolnośląskie', address: 'ul. Sienkiewicza 4', website: 'pcc.rokita.pl', is_local: 0, categories: ['cat-009'] },
  { id: 'sup-083', company_name: 'Distripark.com (Grupa PCC)', city: 'Brzeg Dolny', region: 'dolnośląskie', address: 'ul. Sienkiewicza 4', website: 'distripark.com', is_local: 0, categories: ['cat-009'] },
  { id: 'sup-084', company_name: 'Avantor Performance Materials (POCH)', city: 'Gliwice', region: 'śląskie', address: 'ul. Sowińskiego 11', website: 'poch.com.pl', is_local: 0, categories: ['cat-009'] },
  { id: 'sup-085', company_name: 'Chempur', city: 'Piekary Śląskie', region: 'śląskie', address: 'ul. Lortza 70a', website: 'chempur.pl', is_local: 0, categories: ['cat-009'] },
  { id: 'sup-086', company_name: 'OQEMA Polska', city: 'Warszawa', region: 'mazowieckie', website: 'oqema.pl', is_local: 0, categories: ['cat-009'] },
  { id: 'sup-087', company_name: 'Best-Chem', city: 'Łódź', region: 'łódzkie', website: 'bestchem.com.pl', is_local: 0, categories: ['cat-009'] }
];

async function seed() {
  console.log('Rozpoczynam seedowanie bazy danych...');

  // Tworzenie tabel
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      company TEXT,
      phone TEXT,
      role TEXT DEFAULT 'supplier',
      invitation_token TEXT,
      invitation_expires TEXT,
      is_active INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS material_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      category_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      unit TEXT DEFAULT 'szt.',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES material_categories(id)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      company_name TEXT NOT NULL,
      nip TEXT,
      address TEXT,
      city TEXT,
      region TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      description TEXT,
      is_local INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS supplier_categories (
      supplier_id TEXT,
      category_id TEXT,
      PRIMARY KEY (supplier_id, category_id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (category_id) REFERENCES material_categories(id)
    );

    CREATE TABLE IF NOT EXISTS auctions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      material_id TEXT,
      quantity REAL,
      unit TEXT,
      start_time TEXT,
      end_time TEXT,
      duration_minutes INTEGER DEFAULT 10,
      status TEXT DEFAULT 'pending',
      winner_id TEXT,
      winning_bid REAL,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (material_id) REFERENCES materials(id),
      FOREIGN KEY (winner_id) REFERENCES suppliers(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS auction_invitations (
      id TEXT PRIMARY KEY,
      auction_id TEXT,
      supplier_id TEXT,
      invited_at TEXT DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending',
      FOREIGN KEY (auction_id) REFERENCES auctions(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS bids (
      id TEXT PRIMARY KEY,
      auction_id TEXT,
      supplier_id TEXT,
      amount REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (auction_id) REFERENCES auctions(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );
  `);

  // Dodanie admina
  const adminPassword = await bcrypt.hash('admin123', 10);
  const insertUser = db.prepare(`INSERT OR REPLACE INTO users (id, email, password, name, role, is_active) VALUES (?, ?, ?, ?, ?, ?)`);
  insertUser.run('admin-001', 'admin@auction.pl', adminPassword, 'Administrator', 'admin', 1);
  console.log('Admin utworzony: admin@auction.pl / admin123');

  // Dodanie kategorii
  const insertCategory = db.prepare(`INSERT OR REPLACE INTO material_categories (id, name, description, icon) VALUES (?, ?, ?, ?)`);
  for (const cat of categories) {
    insertCategory.run(cat.id, cat.name, cat.description, cat.icon);
  }
  console.log(`Dodano ${categories.length} kategorii`);

  // Dodanie materiałów
  const insertMaterial = db.prepare(`INSERT OR REPLACE INTO materials (id, category_id, name, description, unit) VALUES (?, ?, ?, ?, ?)`);
  for (const mat of materials) {
    insertMaterial.run(mat.id, mat.category_id, mat.name, mat.description, mat.unit);
  }
  console.log(`Dodano ${materials.length} materiałów`);

  // Dodanie dostawców
  const insertSupplier = db.prepare(`INSERT OR REPLACE INTO suppliers (id, company_name, city, region, address, website, is_local) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const insertSupplierCategory = db.prepare(`INSERT OR REPLACE INTO supplier_categories (supplier_id, category_id) VALUES (?, ?)`);

  for (const sup of suppliers) {
    insertSupplier.run(sup.id, sup.company_name, sup.city, sup.region, sup.address || '', sup.website || '', sup.is_local);
    for (const catId of sup.categories) {
      insertSupplierCategory.run(sup.id, catId);
    }
  }
  console.log(`Dodano ${suppliers.length} dostawców`);

  console.log('Seedowanie zakończone!');
}

seed().catch(console.error);
