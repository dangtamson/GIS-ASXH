create or replace function public.fn_get_task_by_uuid_json(
    p jsonb
)
returns jsonb
language plpgsql
as
$$
declare
v_result jsonb;

v_task_uuid uuid := nullif(p->>'uuid','')::uuid;
v_workspace_id uuid := nullif(p->>'workspaceId','')::uuid;

begin

select to_jsonb(x)
into v_result
from (
         select t.*,

                jsonb_build_object(
                        'uuid', o.uuid,
                        'name', o.name
                ) as organization,

                jsonb_build_object(
                        'title', d.title,
                        'document_number', d.document_number,
                        'document_type', jsonb_build_object(
                                         'uuid', lvb.uuid,
                                         'name', lvb.name
                                         ),
                        'field', jsonb_build_object(
                                'uuid', c.uuid,
                                'name', c.name
                                 )
                ) as document,

                (
                    select to_jsonb(tp)
                    from task_progress tp
                    where tp.task_id = t.uuid
                    order by tp.progress_percent desc, tp.created_at desc
                     limit 1
     ) as task_progress,

     (
         select public.fn_get_assign_by_task_id(t.uuid)
     ) as task_assignments

    from tasks t
                 left join organizations o
on o.uuid = t.organization_id
    left join documents d
    on d.uuid = t.document_id
    left join category_items c
    on c.uuid = d.field_id
    left join category_items lvb
    on d.document_type_id = lvb.uuid

where t.uuid = v_task_uuid and t.workspace_id = v_workspace_id

    ) x;

return coalesce(v_result, '{}'::jsonb);

end;
$$;