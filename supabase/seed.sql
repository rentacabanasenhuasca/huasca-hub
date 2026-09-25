-- ============================================================================
-- Catálogo completo de amenidades, organizado igual que Airbnb (11 categorías)
-- ============================================================================

insert into amenities (category, label, sort_order) values
  -- Destacado
  ('destacado', 'Piscina', 1),
  ('destacado', 'Jacuzzi', 2),
  ('destacado', 'Patio o balcón privado', 3),
  ('destacado', 'Asador (BBQ)', 4),
  ('destacado', 'Fogata / fogatero', 5),
  ('destacado', 'Chimenea interior', 6),
  ('destacado', 'Vista al lago', 7),
  ('destacado', 'Acceso a playa', 8),
  ('destacado', 'Piano', 9),
  ('destacado', 'Mesa de billar', 10),
  ('destacado', 'Gimnasio', 11),

  -- Baño
  ('bano', 'Agua caliente', 1),
  ('bano', 'Shampoo', 2),
  ('bano', 'Acondicionador', 3),
  ('bano', 'Jabón corporal', 4),
  ('bano', 'Secadora de pelo', 5),
  ('bano', 'Productos de limpieza', 6),
  ('bano', 'Bidet', 7),
  ('bano', 'Tina', 8),
  ('bano', 'Regadera exterior', 9),

  -- Recámara y lavandería
  ('recamara_lavanderia', 'Ropa de cama', 1),
  ('recamara_lavanderia', 'Toallas', 2),
  ('recamara_lavanderia', 'Ganchos para ropa', 3),
  ('recamara_lavanderia', 'Almohadas y cobijas extra', 4),
  ('recamara_lavanderia', 'Cortinas blackout', 5),
  ('recamara_lavanderia', 'Plancha', 6),
  ('recamara_lavanderia', 'Lavadora', 7),
  ('recamara_lavanderia', 'Secadora de ropa', 8),
  ('recamara_lavanderia', 'Espacio para guardar ropa', 9),

  -- Entretenimiento
  ('entretenimiento', 'Smart TV', 1),
  ('entretenimiento', 'Bocina / sistema de sonido', 2),
  ('entretenimiento', 'Consola de videojuegos', 3),
  ('entretenimiento', 'Libros y material de lectura', 4),
  ('entretenimiento', 'Equipo de ejercicio', 5),
  ('entretenimiento', 'Conexión ethernet', 6),

  -- Familia
  ('familia', 'Cuna', 1),
  ('familia', 'Silla alta para bebé', 2),
  ('familia', 'Juguetes y libros para niños', 3),
  ('familia', 'Vajilla para niños', 4),
  ('familia', 'Corral / cuna de viaje', 5),
  ('familia', 'Protecciones de seguridad para ventanas', 6),
  ('familia', 'Cambiador', 7),
  ('familia', 'Monitor de bebé', 8),

  -- Clima (calefacción y aire acondicionado)
  ('clima', 'Aire acondicionado', 1),
  ('clima', 'Calefacción', 2),
  ('clima', 'Ventilador de techo', 3),
  ('clima', 'Ventiladores portátiles', 4),

  -- Seguridad del hogar
  ('seguridad', 'Detector de humo', 1),
  ('seguridad', 'Detector de monóxido de carbono', 2),
  ('seguridad', 'Extintor', 3),
  ('seguridad', 'Botiquín de primeros auxilios', 4),
  ('seguridad', 'Caja fuerte', 5),

  -- Internet y oficina
  ('internet_oficina', 'WiFi', 1),
  ('internet_oficina', 'Espacio de trabajo dedicado', 2),

  -- Cocina y comedor
  ('cocina_comedor', 'Cocina equipada', 1),
  ('cocina_comedor', 'Cocineta', 2),
  ('cocina_comedor', 'Refrigerador', 3),
  ('cocina_comedor', 'Frigobar', 4),
  ('cocina_comedor', 'Congelador', 5),
  ('cocina_comedor', 'Estufa', 6),
  ('cocina_comedor', 'Horno', 7),
  ('cocina_comedor', 'Microondas', 8),
  ('cocina_comedor', 'Lavavajillas', 9),
  ('cocina_comedor', 'Utensilios básicos de cocina', 10),
  ('cocina_comedor', 'Vajilla y cubiertos', 11),
  ('cocina_comedor', 'Cafetera', 12),
  ('cocina_comedor', 'Hervidor de agua', 13),
  ('cocina_comedor', 'Tostador', 14),
  ('cocina_comedor', 'Licuadora', 15),
  ('cocina_comedor', 'Copas de vino', 16),
  ('cocina_comedor', 'Utensilios para asador', 17),
  ('cocina_comedor', 'Charola para hornear', 18),

  -- Exterior
  ('exterior', 'Jardín / patio trasero', 1),
  ('exterior', 'Área para comer al aire libre', 2),
  ('exterior', 'Hamaca', 3),
  ('exterior', 'Muebles de exterior', 4),
  ('exterior', 'Camastros', 5),

  -- Estacionamiento e instalaciones
  ('estacionamiento', 'Estacionamiento gratis en la propiedad', 1),
  ('estacionamiento', 'Estacionamiento gratis en la calle', 2),
  ('estacionamiento', 'Estacionamiento de paga', 3),
  ('estacionamiento', 'Cargador para auto eléctrico', 4),
  ('estacionamiento', 'Todo en una planta (sin escaleras)', 5),

  -- Servicios
  ('servicios', 'Desayuno incluido', 1),
  ('servicios', 'Se permiten estancias largas', 2),
  ('servicios', 'Limpieza durante la estancia', 3),
  ('servicios', 'Se permite dejar equipaje', 4),
  ('servicios', 'Autocheck-in', 5),
  ('servicios', 'Se permite fumar', 6),
  ('servicios', 'El anfitrión te recibe', 7);
