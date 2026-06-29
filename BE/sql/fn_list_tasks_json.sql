create or replace function public.fn_list_tasks_json(
    p jsonb
)
    returns jsonb
    language plpgsql
as
$$
declare
    v_result jsonb;

    v_workspace_id uuid := (p->>'workspaceId')::uuid;

    v_status_text text := nullif(p->>'status','');
    v_status task_status := null;

    v_priority task_priority := nullif(p->>'priority','')::task_priority;
    v_organization_id uuid := nullif(p->>'organizationId','')::uuid;
    v_search text := nullif(p->>'search','');
    v_created_from timestamp := nullif(p->>'createdFrom','')::timestamp;
    v_created_to timestamp := nullif(p->>'createdTo','')::timestamp;
    v_due_from date := nullif(p->>'dueFrom','')::date;
    v_due_to date := nullif(p->>'dueTo','')::date;
    v_document_id uuid := nullif(p->>'documentId','')::uuid;

    v_sort_by text := coalesce(p->>'sortBy','createdAt');
    v_sort_order text := coalesce(p->>'sortOrder','desc');

    v_limit int := coalesce((p->>'limit')::int,20);
    v_offset int := coalesce((p->>'offset')::int,0);
    v_field_id uuid := (p->> 'fieldId')::uuid;
    v_remind text := nullif(p->>'remind','');
    v_assign_id uuid := nullif(p->>'assignId','')::uuid;
begin

    if v_status_text in ('new','in_progress','completed') then
        v_status := v_status_text::task_status;
    end if;

    select jsonb_agg(row_to_json(x))
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
                            'document_type_id', d.document_type_id,
                            'field', jsonb_build_object(
                                    'uuid', c.uuid,
                                    'name', c.name
                                     )
                    ) as document,
                    (select to_jsonb(tp)
                     from task_progress tp
                     where tp.task_id = t.uuid
                     order by tp.progress_percent desc, tp.created_at desc
                     limit 1) as task_progress,
                    (
                        select public.fn_get_assign_by_task_id(t.uuid, v_assign_id, v_status_text)
                    ) as task_assignments
             from tasks t
                      left join organizations o
                                on o.uuid = t.organization_id
                      left join documents d
                                on d.uuid = t.document_id
                      left join category_items c
                                on c.uuid = d.field_id
             where
                 t.workspace_id = v_workspace_id
               and t.deleted_at is null

               and (
                 v_status_text is null

                     or (
                     v_status_text = 'issued'
                         and t.status = 'new'
                         and t.issued_date is not null
                     )

                     or (
                     v_status_text in ('pending', 'approved', 'rejected')
                         and exists (
                         select 1
                         from task_assignments ta
                         where ta.task_id = t.uuid
                           and (v_assign_id is null or ta.assigned_to_org_id = v_assign_id)
                           and ta.status = v_status_text
                     )
                     )

                     or (
                     v_status_text not in ('issued','pending','approved','rejected')
                         and t.status = v_status
                     )
                 )

               and (v_priority is null or t.priority = v_priority)
               and (v_organization_id is null or t.organization_id = v_organization_id)
               and (v_search is null or t.title ilike '%' || v_search || '%')
               and (v_created_from is null or t.created_at >= v_created_from)
               and (v_created_to is null or t.created_at <= v_created_to)
               and (v_due_from is null or t.due_date >= v_due_from)
               and (v_due_to is null or t.due_date <= v_due_to)
               and (v_document_id is null or t.document_id = v_document_id)

               and (
                 v_assign_id is null
                     or (
                     exists (
                         select 1
                         from task_assignments ta
                         where ta.task_id = t.uuid
                           and ta.assigned_to_org_id = v_assign_id
                     )
                         and t.issued_date is not null
                     )
                 )

               and (v_field_id is null or t.field_id = v_field_id)

               and (
                 v_remind is null
                     or (
                     v_remind = 'over_due'
                         and t.due_date < current_date
                     )
                     or (
                     v_remind = 'due_soon'
                         and t.due_date >= current_date
                         and t.due_date <= current_date + t.warning_deadline_days * interval '1 day'
                     )
                 )
               and (
                       select public.fn_get_assign_by_task_id(t.uuid, v_assign_id, v_status_text)
                   ) <> '[]'::jsonb

             ORDER BY
                 -- ASC
                 CASE WHEN v_sort_by = 'title' AND v_sort_order = 'asc' THEN t.title END ASC,
                 CASE WHEN v_sort_by = 'createdAt' AND v_sort_order = 'asc' THEN t.created_at END ASC,
                 CASE WHEN v_sort_by = 'dueDate' AND v_sort_order = 'asc' THEN t.due_date END ASC,
                 CASE WHEN v_sort_by = 'priority' AND v_sort_order = 'asc' THEN t.priority END ASC,
                 CASE WHEN v_sort_by = 'status' AND v_sort_order = 'asc' THEN t.status END ASC,

                 -- DESC
                 CASE WHEN v_sort_by = 'title' AND v_sort_order = 'desc' THEN t.title END DESC,
                 CASE WHEN v_sort_by = 'createdAt' AND v_sort_order = 'desc' THEN t.created_at END DESC,
                 CASE WHEN v_sort_by = 'dueDate' AND v_sort_order = 'desc' THEN t.due_date END DESC,
                 CASE WHEN v_sort_by = 'priority' AND v_sort_order = 'desc' THEN t.priority END DESC,
                 CASE WHEN v_sort_by = 'status' AND v_sort_order = 'desc' THEN t.status END DESC

             limit v_limit
                 offset v_offset
         ) x;

    return coalesce(v_result, '[]'::jsonb);

end;
$$;