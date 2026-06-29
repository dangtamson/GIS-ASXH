drop function if exists fn_get_assign_by_task_id;

create or replace function public.fn_get_assign_by_task_id
(
    p_task_id uuid,
    p_assign_id uuid default null,
    p_status text default null
)
    returns jsonb
    language plpgsql
as $$
declare
v_data jsonb;
begin

select coalesce(
               jsonb_agg(
                       jsonb_build_object(
                               'uuid', a.uuid,
                               'status', a.status,
                               'organization',
                               jsonb_build_object(
                                       'uuid', o.uuid,
                                       'name', o.name,
                                       'is_coordination', a.is_coordination
                               ),
                                'assigned_at', a.assigned_at,
                                'assigned_by', a.assigned_by,
                                'start_date', a.start_date,
                                'progress_percent', coalesce((select tp.progress_percent
                                                     from task_assignment_progress tp
                                                     where tp.task_assignment_id = a.uuid
                                                     order by tp.progress_percent desc, tp.created_at desc
                                                     limit 1),0)
                       )
               ),
               '[]'::jsonb
       )
into v_data
from task_assignments a
         left join organizations o
                   on o.uuid = a.assigned_to_org_id
where
    (
       p_assign_id is null
        or
       a.assigned_to_org_id = p_assign_id
        )
    and

    (a.task_id = p_task_id) and deleted_at is null
  and (
    p_status is null
        or a.status = p_status
    );

return v_data;

end;
$$;