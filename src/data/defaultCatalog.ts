import type { Player, Role, SerieAClub } from "@/types";
import { slugify } from "@/lib/utils";

/**
 * Snapshot predefinito del listone FantaMaster fornito per l'asta del 12/09/2026.
 * Usato solo se IndexedDB non contiene ancora giocatori.
 */
const CLUBS = ["Atalanta","Bologna","Cagliari","Como","Fiorentina","Frosinone","Genoa","Inter","Juventus","Lazio","Lecce","Milan","Monza","Napoli","Parma","Roma","Sassuolo","Torino","Udinese","Venezia"] as const;
const ROWS = `Abankwah	18	D	3	0
Aboukhlal	17	A	2	1
Adams	17	A	11	0
Adams A	19	A	6	0
Addai	3	C	3	0
Addo	10	D	1	0
Adopo	2	C	5	0
Adorante	19	A	8	0
Adzic	16	C	6	0
Akanji	7	D	16	0
Akarakiri	2	C	1	0
Akinsanmiro	12	C	3	0
Akpoguma	5	D	4	0
Alajbegovic	8	C	14	1
Ale Gomes	19	D	1	0
Alex Valle	3	D	10	0
Alhassane	1	D	2	0
Alisson Santos	13	C	16	1
Almqvist	14	C	4	1
Amey	5	D	2	0
Amondarain	1	C	5	0
Amorim	6	C	3	0
Anguissa	13	C	10	0
Antov	12	D	1	0
Arena A	15	A	1	0
Arizala	18	D	2	0
Assane Diao	3	C	14	1
Atta	4	C	14	0
Aurelio	2	D	3	0
Badiashile	13	D	6	0
Bakola	16	C	5	1
Bakoune	12	D	1	0
Baldanzi	6	C	9	1
Balentien	11	A	1	0
Balerdi	15	D	8	0
Ballabio	12	C	1	0
Barella	7	C	22	0
Bartesaghi	11	D	9	0
Basic	19	C	7	0
Bastoni	7	D	14	0
Baturina	3	C	24	1
Bayo	18	A	1	0
Belahyane	9	C	3	0
Belghali	17	D	9	0
Bella-Kotchap	19	D	4	0
Bellanova	0	D	7	0
Berardi	16	A	21	1
Berardi L	19	C	1	1
Berisha M	10	C	3	0
Bernabe'	14	C	10	0
Bernardeschi	1	C	15	1
Bernasconi	0	C	3	0
Bertola	18	D	4	0
Beto	4	A	16	0
Beukema	13	D	6	0
Bijlow	6	P	9	0
Biraghi	17	D	4	0
Birindelli	12	D	5	0
Birligea	5	A	4	0
Bisseck	7	D	14	0
Bleve	10	P	1	0
Bobcek	5	A	6	0
Boga	8	A	10	1
Boloca	16	C	1	0
Bondo	11	C	3	0
Bonny	7	A	10	0
Bordon	9	D	1	0
Bovio	7	D	1	0
Bowie	16	A	8	0
Bracaglia	5	D	5	0
Braganca	17	C	8	0
Bremer	8	D	17	0
Brescianini	4	C	6	0
Britschgi	14	D	2	0
Buongiorno	13	D	9	0
Busio	19	C	11	0
Butez	3	P	17	0
Cabal	8	D	3	0
Cacciamani	17	C	3	1
Caleta-Car	16	D	5	0
Calhanoglu	7	C	31	0
Calo'	5	C	10	0
Calvani	5	D	3	0
Camarda	11	A	5	0
Cambiaghi	1	A	8	1
Cambiaso	8	D	9	0
Cancellieri	9	A	8	1
Cande	16	D	1	0
Caprile	2	P	12	0
Caqueret	3	C	9	0
Carboni A	12	D	3	0
Carboni F	14	D	2	0
Carlos Augusto	7	D	11	0
Carnesecchi	0	P	21	0
Carrascosa	17	D	1	0
Casadei	17	C	9	0
Casale	1	D	2	0
Castro S	15	A	16	0
Cataldi	9	C	6	0
Caviglia	14	C	7	0
Celik	8	D	7	0
Chakvetadze	18	C	6	1
Chalobah	3	D	11	0
Christensen	4	P	1	0
Chukwueze	11	C	10	1
Cichella	5	C	2	0
Ciervo	2	C	1	1
Cinquegrano	16	D	4	0
Cisse A	11	C	6	1
Cittadini	5	D	4	0
Ciurria	12	C	4	1
Coco S	17	D	7	0
Colombo	6	A	11	0
Colombo L	12	C	2	0
Colpani	12	C	8	1
Comert	17	D	6	0
Comotto C	11	C	1	0
Comuzzo	17	D	7	0
Conceicao	8	C	16	1
Contini	13	P	1	0
Correia T	19	D	4	0
Corvi	14	P	3	0
Coulibaly L	10	C	8	0
Cremaschi	14	C	1	0
Cristante	15	C	11	0
Croci	4	A	1	1
Cutrone	12	A	9	0
Da Cunha	3	C	17	0
Daffara	14	P	1	0
Dagasso	19	C	2	0
Danilo Veiga	10	D	5	0
Davis	18	A	19	0
De Bruyne	13	C	18	1
De Gea	4	P	12	0
De Ketelaere	0	C	19	1
De Martis	14	A	1	0
De Marzi	15	P	1	0
De Paoli	3	D	1	0
De Roon	15	C	9	0
De Silvestri	1	D	2	0
De Winter	11	D	8	0
Deiola	2	C	4	0
Dele Bashiru	9	C	3	0
Delprato	14	D	8	0
Dembele A	10	D	2	0
Desplanches	5	P	2	0
Di Gennaro R	7	P	1	0
Di Lorenzo	13	D	15	0
Diallo O	14	C	1	1
Diawara S	11	D	1	0
Diego Carlos	14	D	5	0
Diego Moreira	11	C	13	1
Dimarco	7	D	25	0
Diogo Leite	9	D	3	0
Diouf A	7	C	6	0
Dodo D	4	D	7	0
Doekhi	9	D	10	0
Doig	16	D	5	0
Dominguez B	16	C	5	1
Dossena A	3	D	3	0
Douglas Luiz	8	C	6	0
Douvikas	3	A	26	0
Dovbyk	1	A	10	0
Dragusin	4	D	6	0
Drameh	6	D	5	0
Drobnic	14	D	1	0
Duncan	19	C	4	0
Dybala	15	A	21	1
Ebosse	18	D	2	0
Ederson J	0	C	16	0
Ehizibue	6	D	4	0
Ekhator	8	A	6	0
Ekkelenkamp	18	C	10	0
El Azzouzi	1	C	1	0
El Azzouzi A	5	C	1	0
El Bilal Toure	14	A	1	0
El Shaarawy	6	A	9	1
Ellertsson	6	C	1	0
Elmas	0	C	9	0
Elphege	14	A	5	0
Enem	1	A	3	0
Esposito F	7	A	15	0
Esposito S	16	A	10	0
Esteban	10	A	1	0
Estupinan	11	D	4	0
Fabbian	14	C	3	0
Fadera	2	C	4	1
Fagioli	4	C	10	0
Falcone	10	P	16	0
Fanne	19	C	1	0
Farcomeni	9	C	1	0
Fares	9	D	1	0
Fatah	10	A	4	1
Favasuli	13	D	3	0
Fayed	5	D	1	0
Fazzini	2	C	5	0
Felici	2	C	4	1
Ferguson	1	C	11	0
Fini	5	A	2	1
Fitz-Jim	17	C	7	0
Floriani M	9	D	4	0
Foe Ondoa	12	C	4	1
Fofana S	10	C	2	0
Folorunsho	12	C	6	0
Forson	12	C	1	0
Fortini	17	D	3	0
Franjic	19	D	3	0
Frattesi	9	C	14	0
Frendrup	6	C	6	0
Frigan	14	A	1	0
Furlanetto	9	P	1	0
Gabbia	11	D	7	0
Gaetano	0	C	9	1
Gagliardini	2	C	3	0
Galassi	9	C	1	0
Gallo	10	D	5	0
Gandelman	10	C	4	1
Gaspar K	10	D	4	0
Gatti	8	D	6	0
Gelli	5	C	2	1
Geubbels	10	A	3	0
Ghedjemis	5	C	10	1
Ghidotti	14	P	1	0
Ghilardi	15	D	6	0
Ghion	16	C	1	0
Gila	11	D	11	0
Gilmour	13	C	6	0
Gineitis	17	C	4	0
Giovane S	13	A	8	0
Gnonto	4	A	8	1
Goglichidze	12	D	2	0
Goldaniga	3	D	2	0
Gollini	15	P	1	0
Gonzalez N	8	A	6	1
Gorter	10	C	2	0
Grabara	8	P	3	0
Grandi	19	P	1	0
Grillitsch	5	C	6	0
Gudmundsson	9	A	14	1
Gueye	18	A	3	0
Hainaut	19	D	3	0
Halhal	19	D	1	0
Happonen	1	P	1	0
Haps	19	D	7	0
Hasa	5	C	2	1
Havel	6	A	3	0
Heggem	1	D	4	0
Helgason	19	C	4	0
Helland	1	D	5	0
Hermoso	15	D	11	0
Hien	0	D	8	0
Hojlund	13	A	29	0
Holm	1	D	7	0
Hutchinson	11	C	7	1
Idrissi	2	D	2	0
Idzes	16	D	8	0
Ilic	10	C	3	0
Ilkhan	17	C	5	0
Isaksen	9	C	11	1
Ismajli	17	D	4	0
Israel	17	P	1	0
Jashari	11	C	9	0
Jean	10	D	2	0
Jimenez A	4	D	6	0
Joao Mario N	4	D	4	0
Jones	7	C	11	0
Jovanovic	18	C	1	1
Jovic M	10	A	1	0
Juan Jesus	19	D	6	0
Kaba	10	C	1	0
Kabasele	18	D	6	0
Kaiki	3	D	7	0
Kalulu	8	D	12	0
Kamara	18	D	7	0
Kambwala	3	D	3	0
Karlstrom	18	C	9	0
Kean	3	A	26	0
Keita B	12	A	7	1
Kelly	8	D	8	0
Kempf	3	D	8	0
Kessie	0	C	14	0
Kevin Carlos	2	A	7	0
Kike Perez	19	C	7	0
Kofler	2	D	4	0
Kolasinac	0	D	6	0
Kolo Muani	8	A	24	0
Konate A	14	C	1	0
Kone B	5	C	2	0
Kone I	16	C	5	0
Koopmeiners	8	C	11	0
Kossounou	0	D	5	0
Kouadio	12	D	2	0
Koulierakis	15	D	6	0
Kovac N	10	C	1	0
Kristensen T	0	D	7	0
Krstovic	0	A	15	0
Kulenovic	17	A	4	0
Kulla	16	A	1	0
Kvernadze	5	A	8	1
Laerke	10	A	1	1
Lafont G	6	C	1	0
Lahdo	3	C	1	0
Lauberbach	19	A	1	0
Lauriente'	16	A	18	1
Lavelli	7	A	1	0
Lazzari M	9	D	3	0
Leysen	16	D	9	0
Lezzerini	4	P	1	0
Liberali	3	C	6	1
Libra	1	C	1	1
Lipani	16	C	2	0
Lisman	19	C	2	1
Liteta	2	C	1	0
Lobotka	13	C	10	0
Locatelli M	8	C	11	0
Loftus-Cheek	11	C	5	0
Lolic	5	P	1	0
Lontani	14	A	3	0
Lovric	18	C	4	0
Lucca	13	A	7	0
Lucchesi	12	D	3	0
Lucumi	8	D	9	0
Luis Henrique	7	C	8	0
Lulli	15	D	4	0
Luongo	17	C	1	0
Maignan	11	P	20	0
Maldini D	2	C	8	1
Maleh	10	C	4	0
Malen	15	A	35	0
Mancini	15	D	15	0
Mancuso M	7	C	1	0
Mandas	9	P	5	0
Mandela Keita	14	C	5	0
Mandragora	17	C	15	0
Mangas	12	D	6	0
Manu Kone	15	C	17	0
Marcandalli	6	D	4	0
Marello	7	D	1	0
Marianucci	13	D	3	0
Martinez J	7	P	18	0
Martinez L	7	A	35	0
Martins K	12	A	1	1
Marusic	9	D	8	0
Mascardi	17	P	1	0
Masini	5	C	5	0
Massolin	2	C	3	0
Mastantuono	4	C	14	1
Mathias Olivera	13	D	5	0
Matic	16	C	8	0
Maye	12	D	1	0
Mazzocchi	19	D	2	0
Mbangula	1	C	11	1
McKennie	8	C	15	0
McTominay	13	C	27	0
Meichtry	6	C	5	0
Mendy P	2	A	1	0
Meret	13	P	18	0
Messias	6	C	5	1
Milik	8	A	1	0
Milinkovic-Savic V	13	P	7	0
Milla	3	C	9	0
Miller	18	C	3	0
Mina	2	D	7	0
Miranda J	1	D	9	0
Mitaj	6	D	3	0
Mkhitaryan	7	C	9	0
Modric	11	C	14	0
Mohammed	19	D	2	0
Molina N	15	D	12	0
Monteiro	10	C	4	0
Monterisi	5	D	5	0
Montipo'	19	P	1	0
Moreno M	19	D	1	0
Moro N	1	C	6	0
Mosconi	7	A	1	0
Mota	12	A	3	0
Motta E	9	P	12	0
Mout	12	C	1	0
Mrozek	18	P	1	0
Muric A	16	P	12	0
Musah	11	C	7	0
N'Dri	10	A	3	1
Ndaba	10	D	2	0
Ndiaye A	14	D	1	0
Ndicka	15	D	12	0
Ndour	4	C	9	0
Neres	13	C	10	1
Ngom	10	C	1	0
Ngonge	12	A	3	1
Nico Paz	3	C	30	1
Njie	4	C	3	1
Noa Lang	13	C	5	1
Noslin	9	A	7	0
Nuno Tavares	9	D	12	0
Nzola	2	A	6	0
Obert	2	D	7	0
Obrador	16	D	8	0
Odenthal	16	D	3	0
Odgaard	1	C	10	1
Okoye	18	P	13	0
Ordonez	14	C	1	0
Oristanio	17	C	8	1
Orsolini	1	C	25	1
Osmajic	6	A	4	0
Ostigard	6	D	10	0
Otoa	6	D	1	0
Oulai	4	C	4	0
Owusu	8	C	1	0
Oyono	5	D	6	0
Padelli	18	P	1	0
Palamarchuk	10	D	1	0
Palma M	18	D	2	0
Palmisani	5	P	10	0
Panada	19	C	1	0
Pardel	0	P	1	0
Parisi F	4	D	2	0
Pasalic	0	C	9	0
Patric	9	D	3	0
Patterson	17	D	2	0
Pavard	7	D	7	0
Pavlovic S	11	D	13	0
Paz Y	16	D	1	0
Pedraza	9	D	5	0
Pedro Goncalves	4	C	10	1
Pellegri	17	A	1	0
Pellegrini	15	C	10	0
Pellegrini Lu	9	D	4	0
Pellegrino Ma	4	A	17	0
Penev	10	P	1	0
Perri	17	P	10	0
Perrone	3	C	13	0
Pessina	12	C	8	0
Pessina M	1	P	1	0
Piccoli	1	A	11	0
Pieragnolo	16	D	1	0
Pierini	16	A	2	1
Pierotti	10	A	6	1
Pinamonti	9	A	14	0
Pinsoglio	8	P	1	0
Piotrowski	18	C	8	0
Pisilli	15	C	10	0
Pittarella	11	P	1	0
Pobega	1	C	8	0
Politano	13	C	18	1
Pompei	0	P	1	0
Pongracic	4	D	4	0
Pozzi A	19	P	1	0
Provedel	7	P	7	0
Provstgaard	9	D	6	0
Przyborek	9	C	1	1
Puczka	6	D	2	0
Pulisic	11	C	25	1
Rabiot	11	C	23	0
Radunovic	2	P	1	0
Rafa Marin	13	D	2	0
Raimondo	5	A	8	0
Ramon J	3	D	10	0
Ramos G	11	A	28	0
Ranieri	4	D	4	0
Raspadori	0	A	13	1
Rensch	15	D	4	0
Renzetti D	9	P	1	0
Ricci S	3	C	6	0
Robinho J	6	C	2	1
Robinson J	12	C	5	1
Rodrigo Mora	15	C	14	1
Rodriguez J	3	C	9	1
Rodriguez Ju	2	D	4	0
Rodriguez R	17	D	4	0
Romano	2	C	5	0
Romero D	14	A	5	0
Rossi F	0	P	1	0
Rovella	9	C	9	0
Rowe	0	C	16	1
Rrahmani	13	D	14	0
Rrahmani A	19	A	9	0
Rugani	8	D	2	0
Sabelli	6	D	2	0
Saelemaekers	11	C	14	1
Sagrado	19	D	4	0
Salah Eddine	15	D	3	0
Samardzic	0	C	10	0
Sanchez R	3	P	7	0
Sarr P	8	C	8	0
Satalino	16	P	1	0
Scalvini	0	D	9	0
Scamacca	0	A	16	0
Schingtienne	19	D	3	0
Schmid	5	C	8	1
Sherri	2	P	1	0
Siebert	10	D	2	0
Sierro	14	C	2	0
Simeone	17	A	13	0
Siviero	17	P	1	0
Skjellerup	16	A	1	0
Skorupski	1	P	13	0
Smolcic	3	D	5	0
Sohm	19	C	4	0
Solet	18	D	13	0
Sommariva	6	P	1	0
Sottil	4	C	4	1
Soule	15	C	24	1
Sow	6	C	10	0
Spence	7	D	11	0
Spinazzola	13	D	9	0
Sportiello	0	P	1	0
Stankovic A	7	C	5	0
Stankovic F	19	P	10	0
Stolz	6	P	1	0
Stones	7	D	10	0
Strajnar	12	P	1	0
Stulic	10	A	3	0
Sucic	7	C	10	0
Sugamele	2	A	1	0
Sugawara	2	D	5	0
Sulemana	16	C	3	0
Sulemana K	0	C	8	1
Sutalo J	9	D	7	0
Sverko	19	D	2	0
Svilar	15	P	22	0
Taylor	9	C	16	0
Tchato	5	D	2	0
Terracciano	11	P	1	0
Terracciano F	11	D	3	0
Terzic	5	D	6	0
Theate	1	D	6	0
Thiam D	12	P	9	0
Thorstvedt	16	C	14	0
Thuram	7	A	29	0
Thuram K	8	C	11	0
Tiago Gabriel	10	D	8	0
Tomori	11	D	6	0
Toni Fernandez	19	C	2	1
Tornqvist	12	P	1	0
Torriani	11	P	1	0
Toure Id	12	C	5	0
Traore	6	C	7	1
Trepy	2	A	1	0
Troilo	14	D	4	0
Turati	16	P	1	0
Ubani	10	D	1	0
Unai Gomez	18	C	4	1
Valdepenas	4	D	1	0
Valenti	14	D	5	0
Valeri	14	D	8	0
Van der Brempt	16	D	4	0
Varela G	12	A	6	0
Vasquez	6	D	7	0
Vasquez D	15	P	1	0
Vaz M	6	D	1	0
Venturino	6	C	4	1
Vergara	13	C	7	1
Vicario	8	P	19	0
Viery	4	D	2	0
Vigorito	3	P	1	0
Vinciati	18	A	1	0
Vitik	1	D	4	0
Vitinha	6	A	6	0
Vlasic	17	C	16	1
Vojvoda	18	D	5	0
Volpato C	16	C	9	1
Walukiewicz	16	D	5	0
Wesley F	15	D	17	0
Wiafe	6	C	1	0
Winks	2	C	7	0
Woltemade	8	A	22	0
Yan Couto	3	D	12	0
Yeboah J	19	A	13	1
Yildiz	8	A	21	1
Zaccagni	9	C	19	1
Zalewski	0	D	11	0
Zaniolo	18	C	19	1
Zanoli	18	D	4	0
Zapata D	17	A	8	0
Zappacosta	0	D	10	0
Zarraga	18	C	2	0
Ze Pedro	2	D	3	0
Zeballos	12	A	6	1
Zerbin	5	C	3	1
Zhegrova	8	C	6	1
Zielinski	7	C	19	0
Ziolkowski	12	D	2	0
Zortea	1	D	7	0
Zulevic	6	A	1	0`;

export function buildDefaultCatalog(): { players: Player[]; clubs: SerieAClub[] } {
  const players: Player[] = ROWS.split("\n").filter(Boolean).map((line) => {
    const [name, clubIndexRaw, roleRaw, basePriceRaw, treqRaw] = line.split("\t");
    const club = CLUBS[Number(clubIndexRaw)];
    const role = roleRaw as Role;
    return {
      id: `${slugify(name)}__${slugify(club)}__${role.toLowerCase()}`,
      name,
      club,
      role,
      basePrice: Number(basePriceRaw),
      isTrequartista: treqRaw === "1",
      personalRating: "NEUTRAL",
      priorityTier: null,
      targetChoice: null,
      status: "AVAILABLE",
    };
  });

  const clubs: SerieAClub[] = CLUBS.map((name) => ({
    id: slugify(name),
    name,
    tier: null,
  }));

  return { players, clubs };
}
