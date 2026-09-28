INSERT INTO public.area(id,created_at,updated_at,slug,name_key,description_key,parent_id,status,sort)
VALUES('area-phuket',now(),now(),'phuket','area.phuket.name',NULL,NULL,'live',1)
ON CONFLICT(id) DO UPDATE SET name_key=EXCLUDED.name_key,status=EXCLUDED.status;
INSERT INTO public.area(id,created_at,updated_at,slug,name_key,description_key,parent_id,status,sort)
VALUES
('area-layan',now(),now(),'layan','area.layan.name',NULL,'area-phuket','live',10),
('area-bang-tao',now(),now(),'bang-tao','area.bang_tao.name',NULL,'area-phuket','live',20)
ON CONFLICT(id) DO UPDATE SET name_key=EXCLUDED.name_key,status=EXCLUDED.status,parent_id=EXCLUDED.parent_id;
UPDATE public.project SET area_id='area-layan',updated_at=now()
WHERE id='layantara-project-328e43e8-942d-432a-a2a1-6ded9cbfb7de' AND area_id IS NULL;
