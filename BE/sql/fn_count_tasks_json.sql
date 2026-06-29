drop function if exists public.fn_count_tasks_json;

create or replace function public.fn_count_tasks_json(
    p jsonb
)
    returns jsonb
    language plpgsql
as
$$
declare
    v_total int;
    v_over_due int;
    v_due_soon int;

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
    v_field_id uuid := (p->> 'fieldId')::uuid;
    v_assign_id uuid := nullif(p->>'assignId','')::uuid;

begin

    if v_status_text in ('new','in_progress','completed') then
        v_status := v_status_text::task_status;
    end if;

    ---------------- total ----------------

    select count(*)
    into v_total
    from tasks t
    where
        t.workspace_id = v_workspace_id
      and deleted_at is null

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
      and (v_field_id is null or t.field_id = v_field_id)
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
      and (
              select public.fn_get_assign_by_task_id(t.uuid, v_assign_id, v_status_text)
          ) <> '[]'::jsonb
      and (v_document_id is null or t.document_id = v_document_id);


    ---------------- over due ----------------

    select count(*)
    into v_over_due
    from tasks t
    where
        t.workspace_id = v_workspace_id
      and deleted_at is null
      and t.due_date < current_date

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
      and (v_field_id is null or t.field_id = v_field_id)
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
      and (
              select public.fn_get_assign_by_task_id(t.uuid, v_assign_id, v_status_text)
          ) <> '[]'::jsonb
      and (v_document_id is null or t.document_id = v_document_id);


    ---------------- due soon ----------------

    select count(*)
    into v_due_soon
    from tasks t
    where
        t.workspace_id = v_workspace_id
      and deleted_at is null
      and t.due_date >= current_date
      and t.due_date <= current_date + t.warning_deadline_days * interval '1 day'

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
      and (v_field_id is null or t.field_id = v_field_id)
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
      and (
              select public.fn_get_assign_by_task_id(t.uuid, v_assign_id, v_status_text)
          ) <> '[]'::jsonb
      and (v_document_id is null or t.document_id = v_document_id);


    return jsonb_build_object(
            'total', coalesce(v_total, 0),
            'overDue', coalesce(v_over_due, 0),
            'dueSoon', coalesce(v_due_soon, 0)
           );

end;
$$;