# Copy to validate with the client

Lines on the MVP that aren't word for word from svya.com.ar. Each says where it came from. Review at Gate 1, then with the client.

| Where | Line on the MVP | Source on svya.com.ar | Kind |
|---|---|---|---|
| Hero | "Derecho empresario desde 1946" | Founded 1946 to advise companies ("asistencia empresaria") | Condensed |
| Hero | "Asesoramos a empresas nacionales y extranjeras y a entidades del sector público." | "asesorar a compañías y entidades gubernamentales", "clientes… nacionales y extranjeras" | Paraphrase |
| 01 El Estudio | "Soluciones prácticas para cuestiones complejas, con la integridad como norma." | "resolver complejas cuestiones… ofrecer soluciones prácticas… por su integridad y valores" | Paraphrase |
| 01 El Estudio | "…En 1946 nació para asesorar a empresas en materia laboral; hoy abarca prácticamente todas las áreas del derecho argentino." | Historia + "prácticamente todas las áreas del derecho argentino" | Condensed |
| 01 Facts | "El padre del fundador abre su estudio." / "Nace Sáenz Valiente & Asociados." / "Abogados en Palermo, Buenos Aires." | Historia: 1912, 1946; "más de 40 abogados"; the address | Condensed |
| 02 Áreas | "Dos frentes, un mismo criterio." | **New headline**: the site only has two groups (Asesoramiento empresario / Área contenciosa) | New |
| 02 Áreas | 9 + 9 condensed labels | 19 + 13 items; each merge is commented in `src/content/areas.ts`. Left out for now: Derecho de la Salud, Internet E-Commerce | Condensed |
| 03 Equipo | "Un equipo de más de cuarenta abogados." | "sus más de 40 abogados" | Condensed |
| 03 Equipo | One-line field per partner | Condensed from each bio; the reasoning is commented in `src/content/team.ts` | Condensed |
| 03 Equipo | **Eugenia Prieri Belmonte, Eduardo Romero: no field** | No bio on the site. **Ask the client for one line each** | Missing |
| 03 Equipo | Accents in names: Sebastián R. Frabosqui Díaz, Nicolás S. Novoa, María de los Milagros Páez | The partner list has no accents; the bios and the operation text use "Sebastián", "Sra. Páez". **Confirm each partner's preferred spelling** | Normalized |
| 03 Equipo | "In memoriam · José María Sáenz Valiente (padre) · (hijo)" | Listed with † as "(p) (Socio fundador)" and "(h)" | Rewritten |
| 03 Operación | "SVyA asesoró a Exponenciar S.A. en una inversión para adquirir el 12% de Agripay S.A., plataforma de pagos con granos para el agro, en una ronda liderada por Grupo Financiero Galicia." | The operation text (kept in the future tense: "adquirirá… sujeto a condiciones"). **Ask whether it has closed, and its date** | Condensed |
| 04 Carrera | "¿Quiere ser parte del equipo?" + "El mejor ambiente laboral y un excelente espacio para el crecimiento profesional." | Word for word; "No lo dudes, sumate" dropped (it switches to vos) | Trimmed |
| 04 Carrera | "Enviar CV" → `contacto@svya.com.ar`, subject "CV" | The site's "Envíenos su C.V." opens the same address. **Ask whether CVs should go elsewhere (e.g. RR. HH.)** | Same target |
| 03 Equipo | "Of Counsel · José María Méndez Acosta" | Shown since 2.x from the site's Of Counsel box, which svya.com.ar now keeps inside an HTML comment (hidden), with an Asesor Externo (Tomás Bollini) and three more names. **Ask whether Méndez Acosta should still be listed** | Kept for now |
| 03 Equipo | Everyone else (8.4b): Abogados, Procuración, Administración, Colaboradores | The site's visible list, spelled as published ("Perez", "Juarez", "Suarez", "Barragan", "Angeles", "Martinez" without accents). **Ask each person's preferred spelling before launch** | As published |
